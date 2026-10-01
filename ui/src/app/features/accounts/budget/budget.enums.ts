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

/** Mirrors backend `CurrencyType`: the currency a bank row is in. */
export enum CurrencyCode {
  Rd  = 'RD',
  Usd = 'USD',
}

/** What a transaction does to the statement account, for the help tag on each row. */
export enum LineEffect {
  DebtUp      = 'debt-up',
  DebtDown    = 'debt-down',
  SavingsOut  = 'savings-out',
  SavingsIn   = 'savings-in',
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
/** Why saving a line's category failed; picks the message shown under its chips. */
export enum LineError {
  /** 422 NO_EXCHANGE_RATE: a US$ card line and the card has no rate. */
  NoRate  = 'no-rate',
  /** 409: the line changed on the server (e.g. posted or excluded elsewhere). */
  Changed = 'changed',
  Failed  = 'failed',
}

export enum SaveState {
  Idle   = 'idle',
  Dirty  = 'dirty',
  Saving = 'saving',
  Saved  = 'saved',
  Error  = 'error',
}
