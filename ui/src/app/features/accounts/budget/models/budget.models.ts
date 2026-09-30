/**
 * Budget screen contracts. `BudgetHttpApi` maps the backend's `GET /budget-screen` and related
 * responses to these shapes (master plan §3).
 */
import { Period } from '../../../../shared/utils/period';
import { ProgressLevel } from '../../../../shared/utils/progress-level';
import { ImportStatus, LineStatus, LoanKind, SaveState, StatementAccountKind } from '../budget.enums';

export interface CategoryOption {
  accountId: number;
  name: string;
  icon: string;
}

export interface TransactionLine {
  lineId: number;
  /** ISO date `YYYY-MM-DD`. */
  date: string;
  description: string;
  /** RD$ amount; positive = charge, negative = payment/credit. */
  amount: number;
  source: StatementAccountKind;
  sourceIcon: string;
  status: LineStatus;
  categoryId: number | null;
  categoryName: string | null;
  suggestions: CategoryOption[];
}

/** A loan installment paid (or collected) in the month; the interest is part of `amount`. */
export interface LoanPayment {
  /** ISO date `YYYY-MM-DD`. */
  date: string;
  loanAccountId: number;
  loanName: string;
  loanType: LoanKind;
  installmentNumber: number;
  totalInstallments: number | null;
  amount: number;
  interest: number;
}

/** Net result of the month's card transactions: charges − payments. */
export interface StatementResult {
  charges: number;
  payments: number;
  net: number;
}

export interface CardSummary {
  accountId: number;
  name: string;
  icon: string;
  spent: number;
  budget: number | null;
  statement: StatementResult | null;
}

export interface SavingsSummary {
  accountId: number;
  name: string;
  icon: string;
  balance: number;
  income: number;
  /** The month's loan installments, oldest first (plan Q8). */
  loanPayments: LoanPayment[];
}

export interface LastUpload {
  kind: StatementAccountKind;
  accountId: number;
  /** ISO timestamp, or null if never uploaded. */
  uploadedAt: string | null;
}

export interface CategoryRow {
  accountId: number;
  name: string;
  icon: string;
  actual: number;
  budget: number | null;
  /** Most recent earlier saved budget, only when `budget` is null. A hint, never the budget (plan Q4). */
  previousBudget: number | null;
  /** Accounts the spend came from; both when mixed (Decision 1). */
  origins: StatementAccountKind[];
  transactions: TransactionLine[];
  /** Read-only interest of the month's loan installments booked to this category. */
  loanInterest: LoanPayment[];
}

export interface BudgetScreen {
  period: Period;
  card: CardSummary;
  savings: SavingsSummary;
  lastUploads: LastUpload[];
  uncategorized: TransactionLine[];
  /** Sorted server-side: highest actual / budget first, no budget last. */
  categories: CategoryRow[];
  /** Active loans: the "Préstamos" group of "Otra" (plan Q8c). */
  loanOptions: CategoryOption[];
  /** Active income accounts: the "Ingresos" group of "Otra", for money coming in. */
  incomeOptions: CategoryOption[];
}

/** A labelled group of extra choices in "Otra" (e.g. "Ingresos", "Préstamos"), listed after the categories. */
export interface CategoryOptionGroup {
  label: string;
  options: CategoryOption[];
}

export interface UploadResult {
  kind: StatementAccountKind;
  newCount: number;
  autoPostedCount: number;
  uncategorizedCount: number;
  uploadedAt: string;
}

export interface BudgetUpdate {
  accountId: number;
  amount: number;
}

export interface ImportSummary {
  id: number;
  kind: StatementAccountKind;
  accountName: string;
  statementDate: string;
  uploadedAt: string;
  fileName: string;
  status: ImportStatus;
  lineCount: number;
  unresolvedCount: number;
}

export interface ImportDetail extends ImportSummary {
  lines: TransactionLine[];
}

// ── View models (UI only, not part of the API contract) ─────────────────────

export interface CategoryRowView extends CategoryRow {
  /** Budget currently shown in the input (draft if edited, else saved value). */
  budgetInput: number | null;
  /** actual / budgetInput, computed here (the API sends amounts only). */
  pct: number | null;
  level: ProgressLevel;
  dirty: boolean;
  saveState: SaveState;
}

export interface ChipSelection {
  line: TransactionLine;
  categoryId: number;
}

export interface LineUiState {
  state: SaveState;
  /** Category optimistically shown while saving. */
  pendingCategoryId: number | null;
}
