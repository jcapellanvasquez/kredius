/** Which statement account a transaction came from. Mirrors backend `StatementType`. */
export enum StatementAccountKind {
  CreditCard = 'CREDIT_CARD',
  Savings    = 'SAVINGS',
}

/** Mirrors backend `LoanType`: RECEIVED = you pay installments, GIVEN = you collect them. */
export enum LoanKind {
  Received = 'RECEIVED',
  Given    = 'GIVEN',
}

/** Whether a statement line already produced a journal entry. */
export enum LineStatus {
  Posted  = 'POSTED',
  Pending = 'PENDING',
}

/** Mirrors backend `StatementImportStatus`. */
export enum ImportStatus {
  Uploaded      = 'UPLOADED',
  PendingReview = 'PENDING_REVIEW',
  Confirmed     = 'CONFIRMED',
  Reversed      = 'REVERSED',
  Failed        = 'FAILED',
}

/** Save lifecycle shared by category chips, budget inputs and the save bar. */
export enum SaveState {
  Idle   = 'idle',
  Dirty  = 'dirty',
  Saving = 'saving',
  Saved  = 'saved',
  Error  = 'error',
}

/** Mock data sets, selected with `?mock=<value>` while the page runs on `BudgetMockApi`. */
export enum MockScenario {
  Default        = 'default',
  Empty          = 'empty',
  AllCategorized = 'all-categorized',
  Slow           = 'slow',
  LoadError      = 'load-error',
  SaveError      = 'save-error',
}
