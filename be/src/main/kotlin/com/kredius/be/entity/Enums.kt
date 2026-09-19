package com.kredius.be.entity

enum class AccountType { ASSET, LIABILITY, EQUITY, INCOME, EXPENSE }

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

enum class LoanType { GIVEN, RECEIVED }

enum class LoanFrequency { WEEKLY, MONTHLY }

enum class InstallmentStatus { PENDING, PAID }

enum class PrincipalPaymentEffect { REDUCE_TERM, REDUCE_INSTALLMENT }

enum class BudgetOrigin { AUTO_SUGGESTED, MANUAL }
