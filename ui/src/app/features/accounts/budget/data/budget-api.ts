import { Observable } from 'rxjs';
import { Period } from '../../../../shared/utils/period';
import { StatementAccountKind } from '../budget.enums';
import {
  BudgetScreen, BudgetUpdate, CategoryOption, ImportDetail, ImportSummary, UploadEvent,
} from '../models/budget.models';

/** Data access for the budget screen. `BudgetHttpApi` implements it; provided in `budget.routes.ts`. */
export abstract class BudgetApi {
  /** `GET /budget-screen?period=`. */
  abstract getScreen(period: Period): Observable<BudgetScreen>;

  /** Every expense category, for the "Otra" dropdown. */
  abstract getCategoryOptions(): Observable<CategoryOption[]>;

  /**
   * `POST /statement-imports` — skips rows already imported, auto-posts known merchants.
   * `statementDate` (`YYYY-MM-DD`) is metadata for the history; each row posts on its own date.
   * Emits the real upload progress, then one `done` event with the result.
   */
  abstract upload(kind: StatementAccountKind, file: File, statementDate: string): Observable<UploadEvent>;

  /** Unposted line: `PATCH /statement-lines/{id}` posts it. */
  abstract categorize(lineId: number, categoryId: number): Observable<void>;

  /** Posted line: `POST /statement-lines/{id}/recategorize` writes a correction entry. */
  abstract recategorize(lineId: number, categoryId: number): Observable<void>;

  /** `POST /exchange-rates`: the card's RD$ per US$ rate; posts the US$ lines that were waiting for it. */
  abstract saveUsdRate(value: number): Observable<void>;
  /** `POST /budgets/batch-update`. */
  abstract saveBudgets(period: Period, updates: BudgetUpdate[]): Observable<void>;

  /** `GET /statement-imports`. */
  abstract listImports(): Observable<ImportSummary[]>;

  /** `GET /statement-imports/{id}`. */
  abstract getImport(id: number): Observable<ImportDetail>;
}
