package com.kredius.be.service

import com.kredius.be.entity.Account
import com.kredius.be.entity.AccountType
import com.kredius.be.entity.Budget
import com.kredius.be.entity.CurrencyType
import com.kredius.be.entity.EntrySide
import com.kredius.be.entity.InstallmentStatus
import com.kredius.be.entity.JournalEntry
import com.kredius.be.entity.Loan
import com.kredius.be.entity.LoanInstallment
import com.kredius.be.entity.LoanType
import com.kredius.be.entity.ExchangeRate
import com.kredius.be.entity.ExclusionReason
import com.kredius.be.entity.JournalLine
import com.kredius.be.entity.RateContext
import com.kredius.be.entity.StatementImport
import com.kredius.be.entity.StatementImportStatus
import com.kredius.be.entity.StatementLine
import com.kredius.be.entity.StatementLineType
import com.kredius.be.entity.StatementType
import com.kredius.be.entity.User
import com.kredius.be.model.BudgetTransactionLine
import com.kredius.be.repository.AccountBalanceView
import com.kredius.be.repository.AccountRepository
import com.kredius.be.repository.BudgetRepository
import com.kredius.be.repository.LoanInstallmentRepository
import com.kredius.be.repository.LoanRepository
import com.kredius.be.repository.ExchangeRateRepository
import com.kredius.be.repository.JournalLineRepository
import com.kredius.be.repository.StatementImportRepository
import com.kredius.be.repository.StatementLineRepository
import com.kredius.be.repository.TotalsView
import com.kredius.be.repository.UserRepository
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.anyLong
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.math.BigDecimal
import java.time.LocalDate
import java.util.Optional
import kotlin.test.assertEquals
import kotlin.test.assertNull
import com.kredius.be.model.StatementType as ApiStatementType

class BudgetScreenServiceTest {

    private val august = LocalDate.of(2026, 8, 1)
    private val card = Account(id = 2, name = "Tarjeta", type = AccountType.LIABILITY, icon = "credit-card",
        statementType = StatementType.CREDIT_CARD)
    private val savings = Account(id = 1, name = "Ahorros", type = AccountType.ASSET, icon = "building-bank",
        statementType = StatementType.SAVINGS)

    private val accountRepo = mock(AccountRepository::class.java)
    private val importRepo = mock(StatementImportRepository::class.java)
    private val lineRepo = mock(StatementLineRepository::class.java)
    private val journalLineRepo = mock(JournalLineRepository::class.java)
    private val exchangeRateRepo = mock(ExchangeRateRepository::class.java)
    private val budgetRepo = mock(BudgetRepository::class.java)
    private val loanRepo = mock(LoanRepository::class.java)
    private val installmentRepo = mock(LoanInstallmentRepository::class.java)

    private val service = run {
        val userRepo = mock(UserRepository::class.java)
        `when`(userRepo.findById(0L)).thenReturn(Optional.of(User()))
        `when`(accountRepo.findFirstByUserIdAndStatementTypeAndActiveTrueOrderByCodeAsc(0L, StatementType.CREDIT_CARD))
            .thenReturn(card)
        `when`(accountRepo.findFirstByUserIdAndStatementTypeAndActiveTrueOrderByCodeAsc(0L, StatementType.SAVINGS))
            .thenReturn(savings)
        `when`(journalLineRepo.findBalanceBefore(0L, 1L, august.plusMonths(1))).thenReturn(totals("5000.00", "2000.00"))
        `when`(journalLineRepo.findIncomeInto(0L, 1L, august, august.plusMonths(1))).thenReturn(BigDecimal("1200.00"))
        `when`(exchangeRateRepo.findTopByContextOrderByRateDateDesc(RateContext.CREDIT_CARD))
            .thenReturn(ExchangeRate(value = BigDecimal("60.00")))
        BudgetScreenService(
            CurrentUserService(userRepo, 0L), accountRepo, importRepo, lineRepo, journalLineRepo, exchangeRateRepo, budgetRepo,
            loanRepo, installmentRepo,
        )
    }

    private fun totals(debit: String, credit: String) = object : TotalsView {
        override val totalDebit = BigDecimal(debit)
        override val totalCredit = BigDecimal(credit)
    }

    private val food = expense(6, "Comida")
    private val market = expense(7, "Supermercado")
    private val leisure = expense(8, "Diversión")
    private val gas = expense(9, "Gasolina")
    private val transport = expense(10, "Transporte")
    private val expenses = listOf(food, market, leisure, gas, transport)

    private fun expense(id: Long, name: String) =
        Account(id = id, code = 4995 + id.toInt(), name = name, type = AccountType.EXPENSE, icon = "category")

    private fun accountTotals(accountId: Long, debit: String, credit: String = "0") = object : AccountBalanceView {
        override val accountId = accountId
        override val totalDebit = BigDecimal(debit)
        override val totalCredit = BigDecimal(credit)
    }

    /** Comida 1,400 of 2,000; Supermercado 300 of 200; Diversión 0 of 500; Transporte 50, no budget (900 last time). */
    private fun ledger() {
        `when`(accountRepo.findByUserIdAndType(0L, AccountType.EXPENSE)).thenReturn(expenses)
        val ids = expenses.map { it.id }
        `when`(journalLineRepo.findTotalsByPeriod(0L, august, august.plusMonths(1), ids)).thenReturn(listOf(
            accountTotals(6, "1500.00", "100.00"),
            accountTotals(7, "300.00"),
            accountTotals(10, "50.00"),
        ))
        `when`(budgetRepo.findByAccountIdInAndPeriod(ids, august)).thenReturn(listOf(
            Budget(account = food, period = august, amount = BigDecimal("2000.00")),
            Budget(account = market, period = august, amount = BigDecimal("200.00")),
            Budget(account = leisure, period = august, amount = BigDecimal("500.00")),
            Budget(account = gas, period = august, amount = BigDecimal.ZERO), // cleared: no budget
        ))
        `when`(budgetRepo.findTopByAccountIdAndPeriodLessThanOrderByPeriodDesc(9L, august))
            .thenReturn(Budget(account = gas, amount = BigDecimal("800.00")))
        `when`(budgetRepo.findTopByAccountIdAndPeriodLessThanOrderByPeriodDesc(10L, august))
            .thenReturn(Budget(account = transport, amount = BigDecimal("900.00")))
    }

    private fun savingsLine(amount: String, type: StatementLineType = StatementLineType.DEBIT, postedRd: String? = null) =
        StatementLine(
            statementImport = StatementImport(account = savings, type = StatementType.SAVINGS),
            account = savings,
            lineDate = LocalDate.of(2026, 8, 12),
            description = "RETIRO",
            amount = BigDecimal(amount),
            type = type,
            journalLine = postedRd?.let { JournalLine(amountRd = BigDecimal(it)) },
        )

    private fun monthLines(vararg lines: StatementLine) {
        `when`(lineRepo.findByStatementImportUserIdAndStatementImportStatusNotAndLineDateBetween(
            0L, StatementImportStatus.REVERSED, august, LocalDate.of(2026, 8, 31),
        )).thenReturn(lines.toList())
    }

    private fun cardLine(
        amount: String,
        type: StatementLineType = StatementLineType.DEBIT,
        currency: CurrencyType = CurrencyType.RD,
        postedRd: String? = null,
    ) = StatementLine(
        statementImport = StatementImport(account = card, type = StatementType.CREDIT_CARD),
        account = card,
        lineDate = LocalDate.of(2026, 8, 10),
        description = "COMPRA",
        amount = BigDecimal(amount),
        currency = currency,
        type = type,
        journalLine = postedRd?.let { JournalLine(amountRd = BigDecimal(it)) },
    )

    @Test
    fun `card summary counts posted charges as spent and every card line in the statement`() {
        monthLines(
            cardLine("1000.00", postedRd = "1000.00"),
            cardLine("500.00"),
            cardLine("10.00", currency = CurrencyType.USD), // unposted USD at the latest rate: 600
            cardLine("800.00", type = StatementLineType.CREDIT), // the excluded payment row
        )

        val summary = service.get(august).card!!

        assertEquals(1000.0, summary.spent)
        assertEquals(2100.0, summary.statement!!.charges)
        assertEquals(800.0, summary.statement!!.payments)
        assertEquals(1300.0, summary.statement!!.net)
        assertEquals("credit-card", summary.icon)
        assertNull(summary.budget)
    }

    @Test
    fun `a month without card lines has no statement`() {
        monthLines()

        assertNull(service.get(august).card!!.statement)
    }

    @Test
    fun `savings shows the balance at the month's end and the month's income`() {
        monthLines()

        val summary = service.get(LocalDate.of(2026, 8, 17)).savings!!

        assertEquals(3000.0, summary.balance)
        assertEquals(1200.0, summary.income)
    }

    @Test
    fun `last uploads list both statement accounts, null when never uploaded`() {
        monthLines()
        val upload = StatementImport(account = card)
        `when`(importRepo.findTopByAccountIdOrderByCreatedAtDesc(2L)).thenReturn(upload)

        val uploads = service.get(august).lastUploads

        assertEquals(listOf(ApiStatementType.CREDIT_CARD, ApiStatementType.SAVINGS), uploads.map { it.kind })
        assertEquals(upload.createdAt, uploads[0].uploadedAt)
        assertNull(uploads[1].uploadedAt)
    }

    @Test
    fun `categories list spend or a saved budget, sorted by actual over budget`() {
        ledger()
        monthLines()

        val rows = service.get(august).categories

        assertEquals(listOf("Supermercado", "Comida", "Diversión", "Transporte"), rows.map { it.name })
        assertEquals(listOf(300.0, 1400.0, 0.0, 50.0), rows.map { it.actual })
        assertEquals(listOf(200.0, 2000.0, 500.0, null), rows.map { it.budget })
        assertEquals(listOf(null, null, null, 900.0), rows.map { it.previousBudget })
    }

    @Test
    fun `category transactions come from both statements, card first, charges positive`() {
        ledger()
        val charge = cardLine("1000.00", postedRd = "1000.00").apply { categoryAccount = food }
        val refund = cardLine("100.00", type = StatementLineType.CREDIT, postedRd = "100.00").apply { categoryAccount = food }
        val cash = savingsLine("500.00", postedRd = "500.00").apply { categoryAccount = food }
        monthLines(cash, charge, refund)

        val screen = service.get(august)
        val comida = screen.categories.single { it.name == "Comida" }

        assertEquals(listOf(ApiStatementType.CREDIT_CARD, ApiStatementType.SAVINGS), comida.origins)
        assertEquals(listOf(500.0, 1000.0, -100.0), comida.transactions.map { it.amount })
        assertEquals(BudgetTransactionLine.Status.POSTED, comida.transactions[0].status)
        assertEquals("building-bank", comida.transactions[0].sourceIcon)
        assertEquals(2000.0, screen.card!!.budget) // only Comida has card spend
    }

    @Test
    fun `uncategorized lists the month's unposted lines that aren't excluded`() {
        ledger()
        val pending = cardLine("450.00")
        val payment = cardLine("800.00", type = StatementLineType.CREDIT).apply { exclude(ExclusionReason.CARD_PAYMENT_AVOID_DOUBLE_ENTRY) }
        val posted = cardLine("100.00", postedRd = "100.00").apply { categoryAccount = food }
        monthLines(pending, payment, posted)

        val uncategorized = service.get(august).uncategorized

        assertEquals(listOf(450.0), uncategorized.map { it.amount })
        assertEquals(BudgetTransactionLine.Status.PENDING, uncategorized.single().status)
    }

    /** A matcher for a Kotlin non-null parameter; the fallback only avoids Kotlin's null check. */
    private fun anyDate(): LocalDate = any(LocalDate::class.java) ?: LocalDate.MIN

    /** Posted lines in the last 90 days, one per category id given. */
    private fun recentUses(vararg categories: Account) {
        `when`(lineRepo.findByStatementImportUserIdAndStatementImportStatusNotAndLineDateBetween(
            anyLong(), any(StatementImportStatus::class.java) ?: StatementImportStatus.REVERSED, anyDate(), anyDate(),
        )).thenReturn(categories.map { cardLine("10.00", postedRd = "10.00").apply { categoryAccount = it } })
    }

    @Test
    fun `without history, suggestions follow account code order and skip the current category`() {
        ledger()
        val pending = cardLine("450.00")
        val posted = cardLine("100.00", postedRd = "100.00").apply { categoryAccount = food }
        monthLines(pending, posted)

        val screen = service.get(august)

        assertEquals(listOf("Comida", "Supermercado"), screen.uncategorized.single().suggestions.map { it.name })
        val comida = screen.categories.single { it.name == "Comida" }.transactions.single()
        assertEquals(listOf("Supermercado", "Diversión"), comida.suggestions.map { it.name })
    }

    @Test
    fun `suggestions favour the categories used most in the last 90 days`() {
        ledger()
        recentUses(leisure, leisure, leisure, gas)
        val pending = cardLine("450.00")
        val posted = cardLine("100.00", postedRd = "100.00").apply { categoryAccount = leisure }
        monthLines(pending, posted)

        val screen = service.get(august)

        assertEquals(listOf("Diversión", "Gasolina"), screen.uncategorized.single().suggestions.map { it.name })
        val diversion = screen.categories.single { it.name == "Diversión" }.transactions.single()
        assertEquals(listOf("Gasolina", "Comida"), diversion.suggestions.map { it.name })
    }

    @Test
    fun `paid loan installments show on savings, their interest under its category, and loans as options`() {
        ledger()
        monthLines()
        val financial = expense(11, "Gastos Financieros")
        val withFinancial = expenses + financial
        `when`(accountRepo.findByUserIdAndType(0L, AccountType.EXPENSE)).thenReturn(withFinancial)
        `when`(journalLineRepo.findTotalsByPeriod(0L, august, august.plusMonths(1), withFinancial.map { it.id }))
            .thenReturn(listOf(accountTotals(11, "1200.00")))
        val loanAccount = Account(id = 20, name = "Préstamo BHD", type = AccountType.LIABILITY, icon = "building-bank")
        val loan = Loan(account = loanAccount, type = LoanType.RECEIVED, counterpartyName = "BHD", numInstallments = 48)
        val entry = JournalEntry(amount = BigDecimal("7338.15"))
        entry.lines += listOf(
            JournalLine(journalEntry = entry, account = financial, side = EntrySide.DEBIT, amountRd = BigDecimal("1200.00")),
            JournalLine(journalEntry = entry, account = loanAccount, side = EntrySide.DEBIT, amountRd = BigDecimal("6138.15")),
            JournalLine(journalEntry = entry, account = savings, side = EntrySide.CREDIT, amountRd = BigDecimal("7338.15")),
        )
        val installment = LoanInstallment(loan = loan, number = 5, status = InstallmentStatus.PAID,
            actualPaymentDate = LocalDate.of(2026, 8, 25), journalEntry = entry)
        `when`(installmentRepo.findByLoanUserIdAndStatusAndActualPaymentDateBetween(
            0L, InstallmentStatus.PAID, august, LocalDate.of(2026, 8, 31),
        )).thenReturn(listOf(installment))
        `when`(loanRepo.findByUserId(0L)).thenReturn(listOf(
            loan, Loan(account = Account(id = 21, name = "Préstamo viejo"), active = false),
        ))

        val screen = service.get(august)

        val payment = screen.savings!!.loanPayments!!.single()
        assertEquals(LocalDate.of(2026, 8, 25), payment.date)
        assertEquals("Préstamo BHD", payment.loanName)
        assertEquals(5 to 48, payment.installmentNumber to payment.totalInstallments)
        assertEquals(7338.15, payment.amount)
        assertEquals(1200.0, payment.interest)
        val financialRow = screen.categories.single { it.name == "Gastos Financieros" }
        assertEquals(listOf(payment), financialRow.loanInterest)
        assertEquals(1200.0, financialRow.actual)
        assertEquals(listOf("Préstamo BHD"), screen.loanOptions!!.map { it.name })
    }

    @Test
    fun `money coming in is offered income accounts, and income accounts are listed as options`() {
        ledger()
        val salary = Account(id = 4, code = 4001, name = "Salario", type = AccountType.INCOME)
        val interest = Account(id = 5, code = 4002, name = "Intereses Ganados", type = AccountType.INCOME)
        val closed = Account(id = 12, code = 4003, name = "Viejo", type = AccountType.INCOME, active = false)
        `when`(accountRepo.findByUserIdAndType(0L, AccountType.INCOME)).thenReturn(listOf(interest, salary, closed))
        val deposit = savingsLine("198450.00", type = StatementLineType.CREDIT)
        val purchase = savingsLine("500.00")
        monthLines(deposit, purchase)

        val screen = service.get(august)

        val byAmount = screen.uncategorized.associateBy { it.amount }
        assertEquals(listOf("Salario", "Intereses Ganados"), byAmount.getValue(-198450.0).suggestions.map { it.name })
        assertEquals(listOf("Comida", "Supermercado"), byAmount.getValue(500.0).suggestions.map { it.name })
        assertEquals(listOf("Salario", "Intereses Ganados"), screen.incomeOptions!!.map { it.name })
    }

    @Test
    fun `savings shows the bank's balance from the latest statement next to the ledger's on that date`() {
        monthLines()
        assertNull(service.get(august).savings!!.bankBalance) // no statement yet

        val statement = StatementImport(
            account = savings, type = StatementType.SAVINGS,
            cutOffDate = LocalDate.of(2026, 8, 31), closingBalance = BigDecimal("96356.20"),
        )
        `when`(importRepo.findTopByAccountIdAndStatusNotAndClosingBalanceNotNullAndCutOffDateLessThanEqualOrderByCutOffDateDesc(
            1L, StatementImportStatus.REVERSED, LocalDate.of(2026, 8, 31),
        )).thenReturn(statement)

        val check = service.get(august).savings!!.bankBalance!!

        assertEquals(LocalDate.of(2026, 8, 31), check.date)
        assertEquals(96356.20, check.bank)
        assertEquals(3000.0, check.ledger) // the ledger up to 31/08 (debits 5,000 − credits 2,000)
    }
}
