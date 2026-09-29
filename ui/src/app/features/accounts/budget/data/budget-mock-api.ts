import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Observable, map, mergeMap, throwError, timer } from 'rxjs';
import { Period, isInPeriod } from '../../../../shared/utils/period';
import { percentOf } from '../../../../shared/utils/progress-level';
import {
  MOCK_FAIL_LINE_ID, MOCK_LATENCY_MS, MOCK_QUERY_PARAM, MOCK_SLOW_LATENCY_MS, STATEMENT_KIND_ORDER, SUGGESTED_CHIPS,
} from '../budget.constants';
import { ImportStatus, LineStatus, MockScenario, StatementAccountKind } from '../budget.enums';
import {
  BudgetScreen, BudgetUpdate, CategoryOption, CategoryRow, ImportDetail, ImportSummary, TransactionLine, UploadResult,
} from '../models/budget.models';
import { BudgetApi } from './budget-api';
import { MOCK_UPLOAD_TEMPLATES, MockDb, MockImport, MockLine, buildMockDb } from './budget-mock-data';

const MOCK_ERROR = 'Mock API failure';
const SCENARIOS = Object.values(MockScenario) as string[];

/**
 * In-memory stand-in for the backend. Mutations (categorize, save, upload) persist until a full page
 * reload, and every response goes through the same computation the server will do, so totals,
 * percentages and sort order react like the real thing.
 */
@Injectable()
export class BudgetMockApi extends BudgetApi {
  /**
   * Read once: in-app navigation drops query params, so re-reading would silently reset the
   * scenario (and its in-memory state) when opening an old upload. Change it with a full reload.
   */
  private readonly scenarioValue = this.readScenario();
  private readonly db = buildMockDb(this.scenarioValue);
  /** Files already uploaded per kind — re-uploading one simulates bank-reference dedup (0 new). */
  private readonly uploadedFiles = new Set<string>();

  getScreen(period: Period): Observable<BudgetScreen> {
    if (this.scenario() === MockScenario.LoadError) return this.fail();
    return this.respond(() => this.computeScreen(this.data(), period));
  }

  getCategoryOptions(): Observable<CategoryOption[]> {
    return this.respond(() => this.data().categories);
  }

  upload(kind: StatementAccountKind, file: File, statementDate: string): Observable<UploadResult> {
    if (this.scenario() === MockScenario.SaveError) return this.fail();
    return this.respond(() => this.applyUpload(kind, file.name, statementDate));
  }

  categorize(lineId: number, categoryId: number): Observable<void> {
    return this.assign(lineId, categoryId);
  }

  recategorize(lineId: number, categoryId: number): Observable<void> {
    return this.assign(lineId, categoryId);
  }

  saveBudgets(period: Period, updates: BudgetUpdate[]): Observable<void> {
    if (this.scenario() === MockScenario.SaveError) return this.fail();
    return this.respond(() => {
      const budgets = (this.data().budgets[period] ??= {});
      for (const u of updates) {
        if (u.amount > 0) budgets[u.accountId] = u.amount;
        else delete budgets[u.accountId];
      }
    });
  }

  listImports(): Observable<ImportSummary[]> {
    return this.respond(() => {
      const db = this.data();
      return [...db.imports]
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
        .map(i => this.toImportSummary(db, i));
    });
  }

  getImport(id: number): Observable<ImportDetail> {
    const db = this.data();
    const imp = db.imports.find(i => i.id === id);
    if (!imp) return this.fail();
    return this.respond(() => ({
      ...this.toImportSummary(db, imp),
      lines: db.lines.filter(l => l.importId === id).map(l => this.toTransaction(db, l)),
    }));
  }

  // ── Scenario & plumbing ───────────────────────────────────────────────────

  private readScenario(): MockScenario {
    const value = new URLSearchParams(inject(DOCUMENT).location.search).get(MOCK_QUERY_PARAM);
    return value && SCENARIOS.includes(value) ? (value as MockScenario) : MockScenario.Default;
  }

  private scenario(): MockScenario {
    return this.scenarioValue;
  }

  private data(): MockDb {
    return this.db;
  }

  private latency(): number {
    return this.scenario() === MockScenario.Slow ? MOCK_SLOW_LATENCY_MS : MOCK_LATENCY_MS;
  }

  /** Runs `fn` after the simulated latency and returns a deep copy, so callers can't mutate the store. */
  private respond<T>(fn: () => T): Observable<T> {
    return timer(this.latency()).pipe(map(() => structuredClone(fn())));
  }

  private fail<T>(): Observable<T> {
    return timer(this.latency()).pipe(mergeMap(() => throwError(() => new Error(MOCK_ERROR))));
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  private assign(lineId: number, categoryId: number): Observable<void> {
    if (lineId === MOCK_FAIL_LINE_ID) return this.fail();
    return this.respond(() => {
      const line = this.data().lines.find(l => l.lineId === lineId);
      if (!line) throw new Error(MOCK_ERROR);
      line.categoryId = categoryId;
      line.posted = true;
    });
  }

  private applyUpload(kind: StatementAccountKind, fileName: string, statementDate: string): UploadResult {
    const db = this.data();
    const uploadedAt = new Date().toISOString();
    const key = `${kind}:${fileName}`;

    if (this.uploadedFiles.has(key)) {
      db.imports
        .filter(i => i.kind === kind && i.fileName === fileName)
        .forEach(i => (i.uploadedAt = uploadedAt));
      return { kind, newCount: 0, autoPostedCount: 0, uncategorizedCount: 0, uploadedAt };
    }
    this.uploadedFiles.add(key);

    const importId = db.nextImportId++;
    const today = uploadedAt.slice(0, 10);
    const lines: MockLine[] = MOCK_UPLOAD_TEMPLATES[kind].map(t => ({
      lineId: db.nextLineId++,
      importId,
      date: today,
      description: t.description,
      amount: t.amount,
      source: kind,
      categoryId: t.categoryId,
      posted: t.categoryId != null,
      suggestionIds: t.suggestionIds,
    }));
    const uncategorizedCount = lines.filter(l => l.categoryId == null).length;

    db.lines.push(...lines);
    db.imports.push({
      id: importId,
      kind,
      statementDate,
      uploadedAt,
      fileName,
      status: uncategorizedCount > 0 ? ImportStatus.PendingReview : ImportStatus.Confirmed,
    });

    return {
      kind,
      newCount: lines.length,
      autoPostedCount: lines.length - uncategorizedCount,
      uncategorizedCount,
      uploadedAt,
    };
  }

  // ── Server-side computation (what GET /budget-screen will do) ─────────────

  private computeScreen(db: MockDb, period: Period): BudgetScreen {
    const lines = db.lines.filter(l => isInPeriod(l.date, period));
    const spendLines = lines.filter(l => !l.isPayment);
    const budgets = db.budgets[period] ?? {};

    const categories: CategoryRow[] = db.categories
      .map(cat => {
        const own = spendLines.filter(l => l.categoryId === cat.accountId);
        const actual = own.reduce((sum, l) => sum + l.amount, 0);
        const budget = budgets[cat.accountId] ?? null;
        return {
          accountId: cat.accountId,
          name: cat.name,
          icon: cat.icon,
          actual,
          budget,
          pct: percentOf(actual, budget),
          origins: STATEMENT_KIND_ORDER.filter(kind => own.some(l => l.source === kind)),
          transactions: own.sort((a, b) => b.date.localeCompare(a.date)).map(l => this.toTransaction(db, l)),
        };
      })
      .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.actual - a.actual || a.name.localeCompare(b.name));

    const cardLines = lines.filter(l => l.source === StatementAccountKind.CreditCard);
    const charges = cardLines.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0);
    const payments = cardLines.filter(l => l.amount < 0).reduce((s, l) => s - l.amount, 0);
    const cardBudget = categories
      .filter(c => c.origins.includes(StatementAccountKind.CreditCard))
      .reduce((s, c) => s + (c.budget ?? 0), 0) || null;

    return {
      period,
      card: {
        ...db.card,
        spent: charges,
        budget: cardBudget,
        pct: percentOf(charges, cardBudget),
        statement: cardLines.length ? { charges, payments, net: charges - payments } : null,
      },
      savings: {
        accountId: db.savings.accountId,
        name: db.savings.name,
        icon: db.savings.icon,
        balance: db.savings.balance,
        income: db.savings.incomeByPeriod[period] ?? 0,
      },
      lastUploads: STATEMENT_KIND_ORDER.map(kind => ({
        kind,
        accountId: kind === StatementAccountKind.CreditCard ? db.card.accountId : db.savings.accountId,
        uploadedAt: db.imports.filter(i => i.kind === kind).map(i => i.uploadedAt).sort().at(-1) ?? null,
      })),
      uncategorized: spendLines
        .filter(l => l.categoryId == null)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(l => this.toTransaction(db, l)),
      categories,
    };
  }

  private toTransaction(db: MockDb, l: MockLine): TransactionLine {
    const category = db.categories.find(c => c.accountId === l.categoryId) ?? null;
    const suggested = (l.suggestionIds ?? [])
      .map(id => db.categories.find(c => c.accountId === id))
      .filter((c): c is CategoryOption => !!c);
    const fallback = db.categories.filter(c => !suggested.includes(c));
    return {
      lineId: l.lineId,
      date: l.date,
      description: l.description,
      amount: l.amount,
      source: l.source,
      sourceIcon: l.source === StatementAccountKind.CreditCard ? db.card.icon : db.savings.icon,
      status: l.posted ? LineStatus.Posted : LineStatus.Pending,
      categoryId: l.categoryId,
      categoryName: category?.name ?? null,
      suggestions: [...suggested, ...fallback]
        .filter(c => c.accountId !== l.categoryId)
        .slice(0, SUGGESTED_CHIPS),
    };
  }

  private toImportSummary(db: MockDb, i: MockImport): ImportSummary {
    const lines = db.lines.filter(l => l.importId === i.id);
    return {
      id: i.id,
      kind: i.kind,
      accountName: i.kind === StatementAccountKind.CreditCard ? db.card.name : db.savings.name,
      statementDate: i.statementDate,
      uploadedAt: i.uploadedAt,
      fileName: i.fileName,
      status: i.status,
      lineCount: lines.length,
      unresolvedCount: lines.filter(l => !l.isPayment && l.categoryId == null).length,
    };
  }
}
