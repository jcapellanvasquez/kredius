import { AccountIcon } from '../../../shared/constants/account-icons';
import { ProgressThresholds } from '../../../shared/utils/progress-level';
import { StatementAccountKind } from './budget.enums';

/** Bar colour thresholds for this screen (budget_screen_final.md §7): gray < 90%, amber 90–100%, red > 100%. */
export const BUDGET_THRESHOLDS: ProgressThresholds = { warning: 90, danger: 100 };

/**
 * Card ring only (master Decision 15): green 0–70%, amber 71–94%, red 95%+.
 * Values are the first percentage of each band (inclusive).
 */
export const CARD_RING_BANDS = { warningFrom: 71, dangerFrom: 95 } as const;

/** Ledger and bank balances within this many RD$ count as matching (rounding). */
export const BALANCE_TOLERANCE = 0.005;

/** How long each "Procesando" step label shows while a statement uploads. */
export const PROCESSING_STEP_MS = 1400;

/** How long "Guardado" stays visible after a successful save. */
export const SAVED_HINT_MS = 1500;

/** Suggested category chips shown next to the current one (plus "Otra"). */
export const SUGGESTED_CHIPS = 2;

/** Order of the upload slots and origin tags. */
export const STATEMENT_KIND_ORDER: readonly StatementAccountKind[] = [
  StatementAccountKind.CreditCard,
  StatementAccountKind.Savings,
];

export const STATEMENT_FILE_ACCEPT = '.pdf';

/** Icon for a statement account when only its kind is known (e.g. upload history rows). */
export const KIND_ICON: Record<StatementAccountKind, AccountIcon> = {
  [StatementAccountKind.CreditCard]: AccountIcon.CreditCard,
  [StatementAccountKind.Savings]:    AccountIcon.BuildingBank,
};

/** Query parameters of the budget screen. `month` (`YYYY-MM`) keeps the chosen month across refreshes. */
export const BUDGET_QUERY = {
  month: 'month',
} as const;

export const BUDGET_ROUTES = {
  importDetail:   'imports',
  /** Absolute: relative '..' is ambiguous across the empty-path parent routes. */
  root:           '/accounts/budget',
} as const;
