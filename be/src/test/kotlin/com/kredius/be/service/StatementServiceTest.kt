package com.kredius.be.service

import com.kredius.be.entity.Account
import com.kredius.be.entity.AccountType
import com.kredius.be.entity.JournalEntry
import com.kredius.be.entity.JournalLine
import com.kredius.be.entity.StatementImport
import com.kredius.be.entity.StatementImportStatus
import com.kredius.be.entity.StatementLine
import com.kredius.be.entity.StatementLineType
import com.kredius.be.entity.StatementType
import com.kredius.be.entity.User
import com.kredius.be.parser.BhdPdfParser
import com.kredius.be.parser.BhdSavingsPdfParser
import com.kredius.be.repository.AccountRepository
import com.kredius.be.repository.ExchangeRateRepository
import com.kredius.be.repository.JournalEntryRepository
import com.kredius.be.repository.JournalLineRepository
import com.kredius.be.repository.MerchantDictionaryRepository
import com.kredius.be.repository.StatementImportRepository
import com.kredius.be.repository.StatementLineRepository
import com.kredius.be.repository.UserRepository
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.math.BigDecimal
import java.util.Optional
import kotlin.test.assertEquals

class StatementServiceTest {

    private val savedEntries = mutableListOf<JournalEntry>()
    private val importRepo = mock(StatementImportRepository::class.java)

    private val service = run {
        val userRepo = mock(UserRepository::class.java)
        `when`(userRepo.findById(0L)).thenReturn(Optional.of(User()))
        val entryRepo = mock(JournalEntryRepository::class.java)
        `when`(entryRepo.save(any(JournalEntry::class.java)))
            .thenAnswer { (it.arguments[0] as JournalEntry).also(savedEntries::add) }
        val lineRepo = mock(JournalLineRepository::class.java)
        `when`(lineRepo.save(any(JournalLine::class.java))).thenAnswer { it.arguments[0] }
        `when`(lineRepo.saveAndFlush(any(JournalLine::class.java))).thenAnswer { it.arguments[0] }

        StatementService(
            currentUser = CurrentUserService(userRepo, 0L),
            accountRepo = mock(AccountRepository::class.java),
            importRepo = importRepo,
            lineRepo = mock(StatementLineRepository::class.java),
            merchantRepo = mock(MerchantDictionaryRepository::class.java),
            journalEntryRepo = entryRepo,
            exchangeRateRepo = mock(ExchangeRateRepository::class.java),
            parser = mock(BhdPdfParser::class.java),
            savingsParser = mock(BhdSavingsPdfParser::class.java),
            journalService = JournalService(entryRepo, lineRepo),
        )
    }

    private fun cardImport(vararg categories: Account?): StatementImport {
        val card = Account(name = "Tarjeta", type = AccountType.LIABILITY)
        val import = StatementImport(id = 1, account = card, type = StatementType.CREDIT_CARD)
        categories.forEachIndexed { i, category ->
            import.lines += StatementLine(
                statementImport = import,
                account = card,
                description = "COMPRA $i",
                amount = BigDecimal("100.00"),
                type = StatementLineType.DEBIT,
                categoryAccount = category,
            )
        }
        `when`(importRepo.findByIdAndUserId(1L, 0L)).thenReturn(import)
        return import
    }

    @Test
    fun `confirming twice posts each line once`() {
        val food = Account(name = "Comida", type = AccountType.EXPENSE)
        val import = cardImport(food, food)

        service.confirm(1)
        service.confirm(1)

        assertEquals(2, savedEntries.size)
        assertEquals(StatementImportStatus.CONFIRMED, import.status)
    }

    @Test
    fun `uncategorized lines keep the import pending until they are posted`() {
        val food = Account(name = "Comida", type = AccountType.EXPENSE)
        val import = cardImport(food, null)

        service.confirm(1)
        assertEquals(1, savedEntries.size)
        assertEquals(StatementImportStatus.PENDING_REVIEW, import.status)

        import.lines[1].categoryAccount = food
        service.confirm(1)

        assertEquals(2, savedEntries.size)
        assertEquals(StatementImportStatus.CONFIRMED, import.status)
    }
}
