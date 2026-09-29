package com.kredius.be.entity

enum class AccountType(val group: Int) {
    ASSET(1000), LIABILITY(2000), EQUITY(3000), INCOME(4000), EXPENSE(5000);
    val codeRange: IntRange get() = (group + 1)..(group + 999)
}

enum class EntrySide { DEBIT, CREDIT }


// Stored as 'RD' and 'USD' (DB columns are VARCHAR via ddl-auto)
enum class CurrencyType(val symbol: String) {
    RD("RD$"),
    USD("US$")
}

enum class JournalSource {
    MANUAL, CARD_STATEMENT, SAVINGS_STATEMENT, INCOME, LOAN, OPENING_BALANCE
}

enum class RateContext { PAYROLL, CREDIT_CARD, OTHER }

enum class StatementType { CREDIT_CARD, SAVINGS }

enum class StatementLineType { DEBIT, CREDIT, INITIAL_BALANCE }

/** Why a journal entry exists besides an original posting; null for original postings. */
enum class CorrectionType {
    /** Moves a posted line's amount from its old category to the new one. */
    RECATEGORIZATION,
    /** Mirrors another entry (`reversesEntry`) to undo it. */
    REVERSAL,
}

/** Why a statement line is excluded from posting; set together with `isExcluded`. */
enum class ExclusionReason {
    /** Card payment row: the savings statement posts this payment. */
    CARD_PAYMENT_AVOID_DOUBLE_ENTRY,
    INITIAL_BALANCE,
    USER_EXCLUDED,
    LOAN_PAYMENT_ALREADY_RECORDED,
}

enum class StatementImportStatus {
    UPLOADED, PROCESSING, PENDING_REVIEW, CONFIRMED, FAILED, REVERSED
}

enum class LoanType { GIVEN, RECEIVED }

enum class LoanFrequency { WEEKLY, MONTHLY }

enum class InstallmentStatus { PENDING, PAID }

enum class PrincipalPaymentEffect { REDUCE_TERM, REDUCE_INSTALLMENT }

enum class BudgetOrigin { AUTO_SUGGESTED, MANUAL }
