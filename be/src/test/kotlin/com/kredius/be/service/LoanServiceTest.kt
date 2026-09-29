package com.kredius.be.service

import com.kredius.be.entity.Account
import com.kredius.be.entity.AccountType
import com.kredius.be.entity.EntrySide
import com.kredius.be.entity.InstallmentStatus
import com.kredius.be.entity.JournalEntry
import com.kredius.be.entity.JournalLine
import com.kredius.be.entity.Loan
import com.kredius.be.entity.LoanInstallment
import com.kredius.be.entity.LoanType
import com.kredius.be.entity.StatementType
import com.kredius.be.entity.User
import com.kredius.be.exception.ApiException
import com.kredius.be.repository.AccountRepository
import com.kredius.be.repository.JournalEntryRepository
import com.kredius.be.repository.JournalLineRepository
import com.kredius.be.repository.LoanInstallmentRepository
import com.kredius.be.repository.LoanRepository
import com.kredius.be.repository.PrincipalPaymentRepository
import com.kredius.be.repository.StatementLineRepository
import com.kredius.be.repository.UserRepository
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.Mockito.any
import org.mockito.Mockito.anyList
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.http.HttpStatus
import java.math.BigDecimal
import java.time.LocalDate
import java.util.Optional
import kotlin.test.assertEquals

class LoanServiceTest {

    private val savings = Account(id = 1, name = "Cuenta Ahorros BHD", type = AccountType.ASSET,
        statementType = StatementType.SAVINGS)
    private val financialExpenses = Account(id = 10, name = "Gastos Financieros", type = AccountType.EXPENSE)
    private val interestIncome = Account(id = 5, name = "Intereses Ganados", type = AccountType.INCOME)

    private val loanRepo = mock(LoanRepository::class.java)
    private val accountRepo = mock(AccountRepository::class.java)
    private val savedEntries = mutableListOf<JournalEntry>()

    private val service = run {
        val userRepo = mock(UserRepository::class.java)
        `when`(userRepo.findById(0L)).thenReturn(Optional.of(User()))
        `when`(accountRepo.findFirstByUserIdAndStatementTypeAndActiveTrueOrderByCodeAsc(0L, StatementType.SAVINGS))
            .thenReturn(savings)
        `when`(accountRepo.findByUserIdAndType(0L, AccountType.EXPENSE)).thenReturn(listOf(financialExpenses))
        `when`(accountRepo.findByUserIdAndType(0L, AccountType.INCOME)).thenReturn(listOf(interestIncome))
        val entryRepo = mock(JournalEntryRepository::class.java)
        `when`(entryRepo.save(any(JournalEntry::class.java)))
            .thenAnswer { (it.arguments[0] as JournalEntry).also(savedEntries::add) }
        val lineRepo = mock(JournalLineRepository::class.java)
        `when`(lineRepo.saveAll(anyList<JournalLine>())).thenAnswer { it.arguments[0] }
        val installmentRepo = mock(LoanInstallmentRepository::class.java)
        `when`(installmentRepo.save(any(LoanInstallment::class.java))).thenAnswer { it.arguments[0] }

        LoanService(
            loanRepo, installmentRepo, accountRepo, entryRepo, lineRepo,
            mock(PrincipalPaymentRepository::class.java), CurrentUserService(userRepo, 0L),
            mock(StatementLineRepository::class.java),
        )
    }

    /** A loan on account 20 with installment 1: 7,338.15 = 1,200.00 interest + 6,138.15 principal. */
    private fun loan(type: LoanType): Loan {
        val account = Account(id = 20, name = "Préstamo BHD",
            type = if (type == LoanType.RECEIVED) AccountType.LIABILITY else AccountType.ASSET)
        val loan = Loan(account = account, type = type, counterpartyName = "BHD")
        loan.installments += LoanInstallment(
            loan = loan, number = 1, scheduledDate = LocalDate.of(2026, 8, 25),
            scheduledAmount = BigDecimal("7338.15"),
            scheduledInterest = BigDecimal("1200.00"), scheduledPrincipal = BigDecimal("6138.15"),
        )
        `when`(loanRepo.findByAccountIdAndUserId(20L, 0L)).thenReturn(loan)
        return loan
    }

    private fun JournalEntry.sides() = lines.associate { it.account.name to (it.side to it.amountRd) }

    @Test
    fun `paying a received loan installment posts interest, principal and savings on the given date`() {
        val loan = loan(LoanType.RECEIVED)

        service.collectInstallment(20, 1, LocalDate.of(2026, 8, 25))

        val entry = savedEntries.single()
        assertEquals(LocalDate.of(2026, 8, 25), entry.entryDate)
        assertEquals(mapOf(
            "Gastos Financieros" to (EntrySide.DEBIT to BigDecimal("1200.00")),
            "Préstamo BHD" to (EntrySide.DEBIT to BigDecimal("6138.15")),
            "Cuenta Ahorros BHD" to (EntrySide.CREDIT to BigDecimal("7338.15")),
        ), entry.sides())
        val installment = loan.installments.single()
        assertEquals(InstallmentStatus.PAID, installment.status)
        assertEquals(LocalDate.of(2026, 8, 25), installment.actualPaymentDate)
        assertEquals(entry, installment.journalEntry)
    }

    @Test
    fun `collecting a given loan installment debits savings and credits loan and interest income`() {
        loan(LoanType.GIVEN)

        service.collectInstallment(20, 1)

        val entry = savedEntries.single()
        assertEquals(LocalDate.now(), entry.entryDate)
        assertEquals(mapOf(
            "Cuenta Ahorros BHD" to (EntrySide.DEBIT to BigDecimal("7338.15")),
            "Préstamo BHD" to (EntrySide.CREDIT to BigDecimal("6138.15")),
            "Intereses Ganados" to (EntrySide.CREDIT to BigDecimal("1200.00")),
        ), entry.sides())
    }

    @Test
    fun `a paid installment can't be paid again`() {
        loan(LoanType.RECEIVED)
        service.collectInstallment(20, 1)

        val ex = assertThrows<ApiException> { service.collectInstallment(20, 1) }

        assertEquals(HttpStatus.CONFLICT, ex.httpStatus)
        assertEquals(1, savedEntries.size)
    }

    @Test
    fun `without a savings account the payment is rejected`() {
        loan(LoanType.RECEIVED)
        `when`(accountRepo.findFirstByUserIdAndStatementTypeAndActiveTrueOrderByCodeAsc(0L, StatementType.SAVINGS))
            .thenReturn(null)

        val ex = assertThrows<ApiException> { service.collectInstallment(20, 1) }

        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, ex.httpStatus)
    }
}
