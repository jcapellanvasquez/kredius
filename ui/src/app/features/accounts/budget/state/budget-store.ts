import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { concatMap, from, toArray } from 'rxjs';
import { AccountApiService } from '../../account-api.service';
import { Period, currentPeriod, toIsoDate } from '../../../../shared/utils/period';
import { percentOf, progressLevel } from '../../../../shared/utils/progress-level';
import { BUDGET_THRESHOLDS, SAVED_HINT_MS, STATEMENT_KIND_ORDER } from '../budget.constants';
import { LineStatus, SaveState, StatementAccountKind } from '../budget.enums';
import { BUDGET_TEXT } from '../budget.texts';
import { BudgetApi } from '../data/budget-api';
import {
  BudgetScreen, CategoryOption, CategoryRowView, ImportSummary, LineUiState, TransactionLine, UploadResult,
} from '../models/budget.models';

/** Page-level state for the budget screen. Provided by `BudgetPageComponent`. */
@Injectable()
export class BudgetStore {
  private readonly api = inject(BudgetApi);
  private readonly accounts = inject(AccountApiService);
  private readonly destroyRef = inject(DestroyRef);

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

  init(): void {
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
          this.screen.set(screen);
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
    this.load();
    return true;
  }

  // ── Budget edits ──────────────────────────────────────────────────────────

  setDraft(accountId: number, value: number | null): void {
    const saved = this.screen()?.categories.find(c => c.accountId === accountId)?.budget ?? null;
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

    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.setLineState(line.lineId, { state: SaveState.Saved, pendingCategoryId: categoryId });
        this.load(true);
        this.refreshSidebar();
        this.afterHint(() => {
          if (this.lineState(line.lineId)?.state === SaveState.Saved) this.clearLineState(line.lineId);
        });
      },
      error: () => this.setLineState(line.lineId, { state: SaveState.Error, pendingCategoryId: null }),
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

  private setLineState(lineId: number, state: LineUiState): void {
    this.lineStates.update(map => new Map(map).set(lineId, state));
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
