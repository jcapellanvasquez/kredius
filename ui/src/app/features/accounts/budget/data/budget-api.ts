import { Observable } from 'rxjs';
import { Period } from '../../../../shared/utils/period';
import { StatementAccountKind } from '../budget.enums';
import {
  BudgetScreen, BudgetUpdate, CategoryOption, ImportDetail, ImportSummary, UploadResult,
} from '../models/budget.models';

/**
 * Data access for the budget screen. Provided as `BudgetMockApi` until the backend endpoints exist;
 * then swap the provider in `budget.routes.ts` for an HTTP implementation.
 */
export abstract class BudgetApi {
  /** Future `GET /budget-screen?period=`. */
  abstract getScreen(period: Period): Observable<BudgetScreen>;

  /** Every expense category, for the "Otra" dropdown. */
  abstract getCategoryOptions(): Observable<CategoryOption[]>;

  /** Future `POST /statement-imports` — dedups by bank reference, auto-posts known merchants. */
  abstract upload(kind: StatementAccountKind, file: File): Observable<UploadResult>;

  /** Unposted line. Future `PATCH /statement-lines/{id}`. */
  abstract categorize(lineId: number, categoryId: number): Observable<void>;

  /** Posted line — backend writes a correction entry. Future `POST /statement-lines/{id}/recategorize`. */
  abstract recategorize(lineId: number, categoryId: number): Observable<void>;

  /** Future `POST /budgets/batch-update`. */
  abstract saveBudgets(period: Period, updates: BudgetUpdate[]): Observable<void>;

  /** Future `GET /statement-imports`. */
  abstract listImports(): Observable<ImportSummary[]>;

  /** Future `GET /statement-imports/{id}`. */
  abstract getImport(id: number): Observable<ImportDetail>;
}
