package com.kredius.be.service

import com.kredius.be.entity.Account
import com.kredius.be.entity.AccountType
import com.kredius.be.entity.Budget
import com.kredius.be.entity.StatementType
import com.kredius.be.entity.User
import com.kredius.be.exception.ApiException
import com.kredius.be.model.BatchBudgetUpdateRequest
import com.kredius.be.model.BudgetUpdateItem
import com.kredius.be.repository.AccountRepository
import com.kredius.be.repository.BudgetHistoryRepository
import com.kredius.be.repository.BudgetRepository
import com.kredius.be.repository.IncomeEntryRepository
import com.kredius.be.repository.JournalLineRepository
import com.kredius.be.repository.UserRepository
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.mockito.Mockito.`when`
import java.math.BigDecimal
import java.time.LocalDate
import java.util.Optional
import kotlin.test.assertEquals

class ReportServiceTest {

    private val september = LocalDate.of(2026, 9, 1)
    private val card = Account(id = 2, name = "Tarjeta", type = AccountType.LIABILITY, statementType = StatementType.CREDIT_CARD)
    private val loan = Account(id = 3, name = "Préstamo", type = AccountType.LIABILITY)

    private val accountRepo = mock(AccountRepository::class.java)
    private val budgetRepo = mock(BudgetRepository::class.java)
    private val journalLineRepo = mock(JournalLineRepository::class.java)

    private val service = run {
        val userRepo = mock(UserRepository::class.java)
        `when`(userRepo.findById(0L)).thenReturn(Optional.of(User()))
        `when`(accountRepo.findByIdAndUserId(2L, 0L)).thenReturn(card)
        `when`(accountRepo.findByIdAndUserId(3L, 0L)).thenReturn(loan)
        `when`(journalLineRepo.findTotalIncomeCreditByBudgetPeriod(0L, september)).thenReturn(BigDecimal.ZERO)
        ReportService(
            accountRepo, mock(IncomeEntryRepository::class.java), budgetRepo, mock(BudgetHistoryRepository::class.java),
            journalLineRepo, CurrentUserService(userRepo, 0L),
        )
    }

    private fun update(accountId: Long, amount: Double) =
        BatchBudgetUpdateRequest(period = september, updates = listOf(BudgetUpdateItem(accountId = accountId, amount = amount)))

    @Test
    fun `the credit card can have its own budget`() {
        service.batchUpdateBudgets(update(2L, 35000.0))

        val saved = ArgumentCaptor.forClass(Budget::class.java)
        verify(budgetRepo).save(saved.capture())
        assertEquals(card, saved.value.account)
        assertEquals(september, saved.value.period)
        assertEquals(0, BigDecimal("35000").compareTo(saved.value.amount))
    }

    @Test
    fun `other non-expense accounts still can't have a budget`() {
        val error = assertThrows<ApiException> { service.batchUpdateBudgets(update(3L, 500.0)) }

        assertEquals("VALIDATION_ERROR", error.code)
        verifyNoInteractions(budgetRepo)
    }
}
