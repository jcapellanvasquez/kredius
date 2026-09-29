package com.kredius.be.service

import com.kredius.be.entity.Account
import com.kredius.be.entity.AccountType
import com.kredius.be.entity.CurrencyType
import com.kredius.be.entity.ExchangeRate
import com.kredius.be.entity.JournalLine
import com.kredius.be.entity.RateContext
import com.kredius.be.entity.StatementImport
import com.kredius.be.entity.StatementImportStatus
import com.kredius.be.entity.StatementLine
import com.kredius.be.entity.StatementLineType
import com.kredius.be.entity.StatementType
import com.kredius.be.entity.User
import com.kredius.be.repository.AccountRepository
import com.kredius.be.repository.ExchangeRateRepository
import com.kredius.be.repository.JournalLineRepository
import com.kredius.be.repository.StatementImportRepository
import com.kredius.be.repository.StatementLineRepository
import com.kredius.be.repository.TotalsView
import com.kredius.be.repository.UserRepository
import org.junit.jupiter.api.Test
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
        BudgetScreenService(CurrentUserService(userRepo, 0L), accountRepo, importRepo, lineRepo, journalLineRepo, exchangeRateRepo)
    }

    private fun totals(debit: String, credit: String) = object : TotalsView {
        override val totalDebit = BigDecimal(debit)
        override val totalCredit = BigDecimal(credit)
    }

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
        statementImport = StatementImport(account = card),
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
}
