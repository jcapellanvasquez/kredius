import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { concatMap, forkJoin, from, timer, toArray } from 'rxjs';
import { AccountApiService } from '../../account-api.service';
import { byName } from '../../../../shared/utils/by-name';
import { Period, currentPeriod, fromMonthParam, toIsoDate, toMonthParam } from '../../../../shared/utils/period';
import { percentOf, progressLevel } from '../../../../shared/utils/progress-level';
import {
  API_ERROR_CODE, BUDGET_QUERY, BUDGET_THRESHOLDS, MIN_SAVING_MS, SAVED_HINT_MS, STATEMENT_KIND_ORDER,
} from '../budget.constants';
import { LineError, LineStatus, SaveState, StatementAccountKind } from '../budget.enums';
import { BUDGET_TEXT } from '../budget.texts';
import { BudgetApi } from '../data/budget-api';
import {
  BudgetScreen, CardBudgetView, CategoryOption, CategoryOptionGroup, CategoryRowView, ImportSummary, LineUiState,
  TransactionLine, UploadResult,
} from '../models/budget.models';

/** Page-level state for the budget screen. Provided by `BudgetPageComponent`. */
@Injectable()
export class BudgetStore {
  private readonly api = inject(BudgetApi);
  private readonly accounts = inject(AccountApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // ── Screen data ───────────────────────────────────────────────────────────
  readonly period = signal<Period>(currentPeriod());
  readonly screen = signal<BudgetScreen | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly categoryOptions = signal<CategoryOption[]>([]);

  // ── Budget edits (batched, never autosaved) ───────────────────────────────
  readonly drafts = signal<ReadonlyMap<number, number | null>>(new Map());
  readonly budgetSaveState = signal(SaveState.Idle);
  /** Rows saved in the last batch, to flash "Guardado" on them. */
  private readonly recentlySaved = signal<ReadonlySet<number>>(new Set());

  // ── Chip selections, per line ─────────────────────────────────────────────
  readonly lineStates = signal<ReadonlyMap<number, LineUiState>>(new Map());
  /**
   * Lines just categorized from "Sin categorizar": kept in place (showing "Guardado") until the hint
   * ends, although the refreshed data no longer lists them. Keyed by line id, with their old position.
   */
  private readonly settling = signal<ReadonlyMap<number, { line: TransactionLine; index: number }>>(new Map());

  readonly savingRate = signal(false);
  /** Bumped by "Poner tasa": the card summary opens and focuses its rate field. */
  readonly rateRequest = signal(0);

  // ── Upload ────────────────────────────────────────────────────────────────
  readonly uploadOpen = signal(false);
  readonly uploadFiles = signal<Partial<Record<StatementAccountKind, File>>>({});
  /** Statement date sent with the upload (`YYYY-MM-DD`); defaults to today. */
  readonly uploadDate = signal(toIsoDate());
  readonly uploading = signal(false);
  readonly uploadError = signal(false);
  readonly lastUploadResults = signal<UploadResult[] | null>(null);

  // ── History of uploads ────────────────────────────────────────────────────
  readonly historyOpen = signal(false);
  readonly history = signal<ImportSummary[] | null>(null);
  readonly historyLoading = signal(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  /** Extra groups in "Otra", after the expense categories; each sorted by name. */
  readonly optionGroups = computed<CategoryOptionGroup[]>(() => {
    const screen = this.screen();
    return [
      { label: BUDGET_TEXT.incomes, options: [...(screen?.incomeOptions ?? [])].sort(byName) },
      { label: BUDGET_TEXT.loans, options: [...(screen?.loanOptions ?? [])].sort(byName) },
    ].filter(g => g.options.length > 0);
  });

  /** "Sin categorizar" as shown: the server's list plus the lines still settling, at their old position. */
  readonly uncategorized = computed<TransactionLine[]>(() => {
    const list = [...(this.screen()?.uncategorized ?? [])];
    const settling = [...this.settling().entries()].sort(([, a], [, b]) => a.index - b.index);
    for (const [lineId, { line, index }] of settling) {
      if (!list.some(l => l.lineId === lineId)) list.splice(Math.min(index, list.length), 0, line);
    }
    return list;
  });

  /** Categories with drafts applied. Order stays as the server sent it so rows don't jump while typing. */
  readonly categories = computed<CategoryRowView[]>(() => {
    const drafts = this.drafts();
    const batch = this.budgetSaveState();
    const recent = this.recentlySaved();
    return (this.screen()?.categories ?? []).map(row => {
      const dirty = drafts.has(row.accountId);
      const budgetInput = dirty ? drafts.get(row.accountId) ?? null : row.budget;
      const pct = percentOf(row.actual, budgetInput);
      const saveState = dirty
        ? (batch === SaveState.Saving || batch === SaveState.Error ? batch : SaveState.Dirty)
        : (recent.has(row.accountId) ? SaveState.Saved : SaveState.Idle);
      return { ...row, budgetInput, pct, level: progressLevel(pct, BUDGET_THRESHOLDS), dirty, saveState };
    });
  });

  /** Categories worth showing in "Comparativo rápido": any spend or budget. */
  readonly compareRows = computed(() => this.categories().filter(c => c.actual > 0 || (c.budgetInput ?? 0) > 0));

  /** The card's budget with its draft applied (the card saves through the same "Guardar cambios" batch). */
  readonly cardBudget = computed<CardBudgetView | null>(() => {
    const card = this.screen()?.card;
    if (!card) return null;
    const drafts = this.drafts();
    const batch = this.budgetSaveState();
    const dirty = drafts.has(card.accountId);
    const carried = card.budgetFromMonth !== null && card.budgetFromMonth < this.period();
    return {
      value: dirty ? drafts.get(card.accountId) ?? null : card.budget,
      dirty,
      saveState: dirty
        ? (batch === SaveState.Saving || batch === SaveState.Error ? batch : SaveState.Dirty)
        : (this.recentlySaved().has(card.accountId) ? SaveState.Saved : SaveState.Idle),
      carriedFrom: !dirty && carried ? card.budgetFromMonth : null,
    };
  });

  readonly dirtyCount = computed(() => this.drafts().size);
  readonly hasUnsavedChanges = computed(() => this.dirtyCount() > 0);

  /** The single most over-budget category gets the accent icon tile. */
  readonly highlightId = computed(() => {
    const over = this.categories().filter(c => (c.pct ?? 0) > BUDGET_THRESHOLDS.danger);
    return over.sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0]?.accountId ?? null;
  });

  readonly canProcess = computed(() =>
    !this.uploading() && !!this.uploadDate() && Object.values(this.uploadFiles()).some(Boolean));

  readonly uploadSummary = computed(() => {
    const results = this.lastUploadResults();
    if (!results) return null;
    const newCount = results.reduce((s, r) => s + r.newCount, 0);
    const uncategorized = results.reduce((s, r) => s + r.uncategorizedCount, 0);
    return BUDGET_TEXT.uploadResult(newCount, uncategorized);
  });

  // ── Loading ───────────────────────────────────────────────────────────────

  /** Opens the month in the URL (`?month=YYYY-MM`), else the current one. */
  init(): void {
    const fromUrl = fromMonthParam(this.route.snapshot.queryParamMap.get(BUDGET_QUERY.month));
    if (fromUrl) this.period.set(fromUrl);
    this.load();
    this.api.getCategoryOptions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(options => this.categoryOptions.set(options));
  }

  /** `silent` refreshes data after a mutation without flashing the skeleton. */
  load(silent = false): void {
    if (!silent) this.loading.set(true);
    this.loadError.set(false);
    this.api.getScreen(this.period())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: screen => {
          this.screen.set(silent ? this.keepCategoryOrder(screen) : screen);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          if (!silent) this.loadError.set(true);
        },
      });
  }

  /** Returns false when the user keeps their unsaved edits instead. */
  changePeriod(period: Period): boolean {
    if (this.hasUnsavedChanges() && !confirm(BUDGET_TEXT.unsavedConfirm)) return false;
    this.discardDrafts();
    this.lineStates.set(new Map());
    this.period.set(period);
    // replaceUrl: switching months shouldn't fill the back button's history.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [BUDGET_QUERY.month]: toMonthParam(period) },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.load();
    return true;
  }

  // ── Budget edits ──────────────────────────────────────────────────────────

  setDraft(accountId: number, value: number | null): void {
    const screen = this.screen();
    const saved = accountId === screen?.card.accountId
      ? screen.card.budget
      : screen?.categories.find(c => c.accountId === accountId)?.budget ?? null;
    const next = new Map(this.drafts());
    if (value === saved) next.delete(accountId);
    else next.set(accountId, value);
    this.drafts.set(next);
    if (this.budgetSaveState() !== SaveState.Saving) {
      this.budgetSaveState.set(next.size > 0 ? SaveState.Dirty : SaveState.Idle);
    }
  }

  discardDrafts(): void {
    this.drafts.set(new Map());
    this.budgetSaveState.set(SaveState.Idle);
  }

  saveBudgets(): void {
    if (!this.hasUnsavedChanges() || this.budgetSaveState() === SaveState.Saving) return;
    const updates = [...this.drafts()].map(([accountId, amount]) => ({ accountId, amount: amount ?? 0 }));
    this.budgetSaveState.set(SaveState.Saving);
    this.api.saveBudgets(this.period(), updates)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.recentlySaved.set(new Set(updates.map(u => u.accountId)));
          this.drafts.set(new Map());
          this.budgetSaveState.set(SaveState.Saved);
          this.load(true);
          this.afterHint(() => {
            this.recentlySaved.set(new Set());
            if (this.budgetSaveState() === SaveState.Saved) this.budgetSaveState.set(SaveState.Idle);
          });
        },
        error: () => this.budgetSaveState.set(SaveState.Error),
      });
  }

  /** Saves the card's US$ rate; the server posts the US$ lines that were waiting, so the data reloads. */
  saveUsdRate(value: number): void {
    if (this.savingRate()) return;
    this.savingRate.set(true);
    this.api.saveUsdRate(value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingRate.set(false);
          this.clearLineErrors(LineError.NoRate);
          this.load(true);
          this.refreshSidebar();
        },
        error: () => this.savingRate.set(false),
      });
  }

  requestRateEdit(): void {
    this.rateRequest.update(n => n + 1);
  }

  /** "Recargar el mes" after a conflict: drop the stale errors and fetch the month again. */
  reloadMonth(): void {
    this.clearLineErrors();
    this.load();
  }

  // ── Category chips ────────────────────────────────────────────────────────

  lineState(lineId: number): LineUiState | undefined {
    return this.lineStates().get(lineId);
  }

  chooseCategory(line: TransactionLine, categoryId: number): void {
    const current = this.lineState(line.lineId);
    if (current?.state === SaveState.Saving) return;
    if (categoryId === line.categoryId && current?.state !== SaveState.Error) return;

    this.setLineState(line.lineId, { state: SaveState.Saving, pendingCategoryId: categoryId });
    const call = line.status === LineStatus.Posted
      ? this.api.recategorize(line.lineId, categoryId)
      : this.api.categorize(line.lineId, categoryId);

    forkJoin([call, timer(MIN_SAVING_MS)]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.setLineState(line.lineId, { state: SaveState.Saved, pendingCategoryId: categoryId });
        this.keepSettling(line);
        this.load(true);
        this.refreshSidebar();
        this.afterHint(() => {
          if (this.lineState(line.lineId)?.state === SaveState.Saved) this.clearLineState(line.lineId);
          this.dropSettling(line.lineId);
        });
      },
      error: (err: unknown) =>
        this.setLineState(line.lineId, { state: SaveState.Error, pendingCategoryId: null, error: lineErrorOf(err) }),
    });
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  toggleUpload(): void {
    this.uploadOpen.update(open => !open);
    if (!this.uploadOpen()) this.historyOpen.set(false);
  }

  setFile(kind: StatementAccountKind, file: File | null): void {
    this.uploadFiles.update(files => {
      const next = { ...files };
      if (file) next[kind] = file;
      else delete next[kind];
      return next;
    });
    this.uploadError.set(false);
  }

  setUploadDate(date: string): void {
    this.uploadDate.set(date);
  }

  process(): void {
    if (!this.canProcess()) return;
    const files = this.uploadFiles();
    const statementDate = this.uploadDate();
    const picked = STATEMENT_KIND_ORDER.filter(kind => files[kind]);

    this.uploading.set(true);
    this.uploadError.set(false);
    from(picked)
      .pipe(
        concatMap(kind => this.api.upload(kind, files[kind] as File, statementDate)),
        toArray(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: results => {
          this.uploading.set(false);
          this.lastUploadResults.set(results);
          this.uploadFiles.set({});
          this.uploadOpen.set(false);
          this.historyOpen.set(false);
          this.history.set(null);
          this.load(true);
          this.refreshSidebar();
        },
        error: () => {
          this.uploading.set(false);
          this.uploadError.set(true);
        },
      });
  }

  // ── Upload history ────────────────────────────────────────────────────────

  toggleHistory(): void {
    this.historyOpen.update(open => !open);
    if (this.historyOpen() && !this.history()) this.loadHistory();
  }

  private loadHistory(): void {
    this.historyLoading.set(true);
    this.api.listImports()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => { this.history.set(list); this.historyLoading.set(false); },
        error: () => { this.history.set([]); this.historyLoading.set(false); },
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Transactions change account balances, so the sidebar list must reload. */
  private refreshSidebar(): void {
    // Best effort: the sidebar keeps its current data if the reload fails.
    this.accounts.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
  }

  /**
   * A background refresh keeps the categories in their current order, so rows don't jump while the
   * user works; new rows go last. The server's order applies on a full load (e.g. changing month).
   */
  private keepCategoryOrder(fresh: BudgetScreen): BudgetScreen {
    const current = this.screen()?.categories ?? [];
    const position = new Map(current.map((row, i) => [row.accountId, i]));
    const categories = [...fresh.categories].sort((a, b) =>
      (position.get(a.accountId) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.accountId) ?? Number.MAX_SAFE_INTEGER));
    return { ...fresh, categories };
  }

  /** Only lines categorized from "Sin categorizar" settle; posted lines just move on refresh. */
  private keepSettling(line: TransactionLine): void {
    const index = this.screen()?.uncategorized.findIndex(l => l.lineId === line.lineId) ?? -1;
    if (index < 0) return;
    this.settling.update(map => new Map(map).set(line.lineId, { line, index }));
  }

  private dropSettling(lineId: number): void {
    this.settling.update(map => {
      const next = new Map(map);
      next.delete(lineId);
      return next;
    });
  }

  private setLineState(lineId: number, state: LineUiState): void {
    this.lineStates.update(map => new Map(map).set(lineId, state));
  }

  /** Removes the error state of every line, or only of lines with that error. */
  private clearLineErrors(error?: LineError): void {
    const next = new Map(this.lineStates());
    for (const [id, ui] of next) {
      if (ui.state === SaveState.Error && (error === undefined || ui.error === error)) next.delete(id);
    }
    this.lineStates.set(next);
  }

  private clearLineState(lineId: number): void {
    this.lineStates.update(map => {
      const next = new Map(map);
      next.delete(lineId);
      return next;
    });
  }

  private afterHint(fn: () => void): void {
    const id = setTimeout(fn, SAVED_HINT_MS);
    this.destroyRef.onDestroy(() => clearTimeout(id));
  }
}

/** Maps a failed categorize/recategorize call to the message the line shows. */
function lineErrorOf(err: unknown): LineError {
  if (!(err instanceof HttpErrorResponse)) return LineError.Failed;
  const code = (err.error as { code?: string } | null)?.code;
  if (code === API_ERROR_CODE.noExchangeRate) return LineError.NoRate;
  if (code === API_ERROR_CODE.conflict || err.status === 409) return LineError.Changed;
  return LineError.Failed;
}
