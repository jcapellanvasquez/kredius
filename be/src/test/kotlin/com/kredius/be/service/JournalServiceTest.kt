package com.kredius.be.service

import com.kredius.be.entity.Account
import com.kredius.be.entity.AccountType
import com.kredius.be.entity.EntrySide
import com.kredius.be.entity.JournalEntry
import com.kredius.be.entity.JournalLine
import com.kredius.be.entity.JournalSource
import com.kredius.be.entity.StatementImport
import com.kredius.be.entity.StatementLine
import com.kredius.be.entity.StatementLineType
import com.kredius.be.entity.User
import com.kredius.be.repository.JournalEntryRepository
import com.kredius.be.repository.JournalLineRepository
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.math.BigDecimal
import kotlin.test.assertEquals

class JournalServiceTest {

    @ParameterizedTest(name = "{0} row on {1} → statement {2}, category {3}")
    @CsvSource(
        "DEBIT,  LIABILITY, CREDIT, DEBIT",  // card charge: debt goes up
        "CREDIT, LIABILITY, DEBIT,  CREDIT", // card payment/refund: debt goes down
        "DEBIT,  ASSET,     CREDIT, DEBIT",  // savings purchase: money goes out
        "CREDIT, ASSET,     DEBIT,  CREDIT", // savings income: money comes in
    )
    fun `sides follow the row direction`(
        direction: StatementLineType,
        accountType: AccountType,
        statementSide: EntrySide,
        categorySide: EntrySide,
    ) {
        val sides = JournalService.sidesFor(direction, accountType)

        assertEquals(statementSide, sides.statementAccount)
        assertEquals(categorySide, sides.category)
    }

    @Test
    fun `initial balance rows are rejected`() {
        assertThrows<IllegalArgumentException> {
            JournalService.sidesFor(StatementLineType.INITIAL_BALANCE, AccountType.ASSET)
        }
    }

    @ParameterizedTest(name = "{0} row on {1} balances")
    @CsvSource("DEBIT, LIABILITY", "CREDIT, LIABILITY", "DEBIT, ASSET", "CREDIT, ASSET")
    fun `posted entry has debits equal to credits`(direction: StatementLineType, accountType: AccountType) {
        val saved = mutableListOf<JournalLine>()
        val entryRepo = mock(JournalEntryRepository::class.java)
        val lineRepo = mock(JournalLineRepository::class.java)
        `when`(entryRepo.save(any(JournalEntry::class.java))).thenAnswer { it.arguments[0] }
        `when`(lineRepo.save(any(JournalLine::class.java))).thenAnswer { (it.arguments[0] as JournalLine).also(saved::add) }
        `when`(lineRepo.saveAndFlush(any(JournalLine::class.java))).thenAnswer { (it.arguments[0] as JournalLine).also(saved::add) }

        val statementAccount = Account(name = "Statement", type = accountType)
        val line = StatementLine(
            description = "UBER *TRIP",
            amount = BigDecimal("450.00"),
            type = direction,
            categoryAccount = Account(name = "Category", type = AccountType.EXPENSE),
        )
        JournalService(entryRepo, lineRepo).saveJournalLine(
            line = line,
            importStatement = StatementImport(account = statementAccount),
            source = JournalSource.CARD_STATEMENT,
            usdRate = null,
            currentUser = User(),
            amountRd = line.amount,
        )

        assertEquals(2, saved.size)
        val debits = saved.filter { it.side == EntrySide.DEBIT }.sumOf { it.amountRd }
        val credits = saved.filter { it.side == EntrySide.CREDIT }.sumOf { it.amountRd }
        assertEquals(BigDecimal("450.00"), debits)
        assertEquals(debits, credits)
    }
}
