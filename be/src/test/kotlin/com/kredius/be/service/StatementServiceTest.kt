package com.kredius.be.service

import com.kredius.be.entity.Account
import com.kredius.be.entity.AccountType
import com.kredius.be.entity.CurrencyType
import com.kredius.be.entity.JournalEntry
import com.kredius.be.entity.JournalLine
import com.kredius.be.entity.MerchantDictionary
import com.kredius.be.entity.StatementImport
import com.kredius.be.entity.StatementImportStatus
import com.kredius.be.entity.StatementLine
import com.kredius.be.entity.StatementLineType
import com.kredius.be.entity.StatementType
import com.kredius.be.entity.User
import com.kredius.be.parser.BhdPdfParser
import com.kredius.be.parser.BhdSavingsPdfParser
import com.kredius.be.parser.ParsedStatementRow
import com.kredius.be.parser.RowDirection
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
import org.mockito.Mockito.anyLong
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.mock.web.MockMultipartFile
import java.io.InputStream
import java.math.BigDecimal
import java.time.LocalDate
import java.util.Optional
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import com.kredius.be.model.StatementType as ApiStatementType

class StatementServiceTest {

    private val card = Account(id = 2, name = "Tarjeta", type = AccountType.LIABILITY)
    private val food = Account(name = "Comida", type = AccountType.EXPENSE)

    private val savedEntries = mutableListOf<JournalEntry>()
    private val storedLines = mutableListOf<StatementLine>()
    private val importRepo = mock(StatementImportRepository::class.java)
    private val cardParser = mock(BhdPdfParser::class.java)
    private val merchantRepo = mock(MerchantDictionaryRepository::class.java)

    private val service = run {
        val userRepo = mock(UserRepository::class.java)
        `when`(userRepo.findById(0L)).thenReturn(Optional.of(User()))
        val accountRepo = mock(AccountRepository::class.java)
        `when`(accountRepo.findByIdAndUserId(2L, 0L)).thenReturn(card)
        `when`(importRepo.save(any(StatementImport::class.java))).thenAnswer { it.arguments[0] }
        val statementLineRepo = mock(StatementLineRepository::class.java)
        `when`(statementLineRepo.findByAccountIdAndLineDateBetween(anyLong(), anyDate(), anyDate()))
            .thenAnswer { storedLines.toList() }
        val entryRepo = mock(JournalEntryRepository::class.java)
        `when`(entryRepo.save(any(JournalEntry::class.java)))
            .thenAnswer { (it.arguments[0] as JournalEntry).also(savedEntries::add) }
        val lineRepo = mock(JournalLineRepository::class.java)
        `when`(lineRepo.save(any(JournalLine::class.java))).thenAnswer { it.arguments[0] }
        `when`(lineRepo.saveAndFlush(any(JournalLine::class.java))).thenAnswer { it.arguments[0] }

        StatementService(
            currentUser = CurrentUserService(userRepo, 0L),
            accountRepo = accountRepo,
            importRepo = importRepo,
            lineRepo = statementLineRepo,
            merchantRepo = merchantRepo,
            journalEntryRepo = entryRepo,
            exchangeRateRepo = mock(ExchangeRateRepository::class.java),
            parser = cardParser,
            savingsParser = mock(BhdSavingsPdfParser::class.java),
            journalService = JournalService(entryRepo, lineRepo),
        )
    }

    /** A matcher for a Kotlin non-null parameter; the fallback only avoids Kotlin's null check. */
    private fun anyDate(): LocalDate = any(LocalDate::class.java) ?: LocalDate.MIN

    private fun cardImport(vararg categories: Account?): StatementImport {
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

    private fun row(day: Int, description: String, amount: String, occurrence: Int = 1) = ParsedStatementRow(
        date = LocalDate.of(2026, 8, day),
        description = description,
        amount = BigDecimal(amount),
        currency = CurrencyType.RD,
        direction = RowDirection.DEBIT,
        occurrenceIndex = occurrence,
    )

    /** Uploads [rows] as a card statement and keeps its lines as the account's stored lines. */
    private fun uploadCard(vararg rows: ParsedStatementRow): StatementImport {
        `when`(cardParser.parse(any(InputStream::class.java) ?: InputStream.nullInputStream())).thenReturn(rows.toList())
        var saved: StatementImport? = null
        `when`(importRepo.save(any(StatementImport::class.java)))
            .thenAnswer { (it.arguments[0] as StatementImport).also { i -> saved = i } }
        service.upload(
            MockMultipartFile("file", ByteArray(0)), 2L, ApiStatementType.CREDIT_CARD, LocalDate.of(2026, 8, 26)
        )
        return saved!!.also { storedLines += it.lines }
    }

    private fun knownMerchant(pattern: String, account: Account) {
        `when`(merchantRepo.findByUserIdOrderByTextPatternAsc(0L))
            .thenReturn(listOf(MerchantDictionary(textPattern = pattern, account = account)))
    }

    @Test
    fun `confirming twice posts each line once`() {
        val import = cardImport(food, food)

        service.confirm(1)
        service.confirm(1)

        assertEquals(2, savedEntries.size)
        assertEquals(StatementImportStatus.CONFIRMED, import.status)
    }

    @Test
    fun `uncategorized lines keep the import pending until they are posted`() {
        val import = cardImport(food, null)

        service.confirm(1)
        assertEquals(1, savedEntries.size)
        assertEquals(StatementImportStatus.PENDING_REVIEW, import.status)

        import.lines[1].categoryAccount = food
        service.confirm(1)

        assertEquals(2, savedEntries.size)
        assertEquals(StatementImportStatus.CONFIRMED, import.status)
    }

    @Test
    fun `uploading the same rows twice adds nothing the second time`() {
        val rows = arrayOf(row(1, "SUPERMERCADO", "1500.00"), row(1, "CAFE", "100.00"), row(1, "CAFE", "100.00", 2))

        val first = uploadCard(*rows)
        val second = uploadCard(*rows)

        assertEquals(3, first.lines.size)
        assertEquals(StatementImportStatus.PENDING_REVIEW, first.status)
        assertEquals(0, second.lines.size)
        assertEquals(StatementImportStatus.CONFIRMED, second.status)
    }

    @Test
    fun `a longer statement adds only the extra rows`() {
        uploadCard(row(1, "SUPERMERCADO", "1500.00"), row(1, "CAFE", "100.00"))

        val longer = uploadCard(
            row(1, "SUPERMERCADO", "1500.00"),
            row(1, "CAFE", "100.00"),
            row(1, "CAFE", "100.00", 2),
            row(3, "GASOLINA", "2000.00"),
        )

        assertEquals(
            listOf("CAFE" to 2, "GASOLINA" to 1),
            longer.lines.map { it.description to it.occurrenceIndex },
        )
    }

    @Test
    fun `upload posts matched lines and leaves the rest pending`() {
        knownMerchant("CAFE", food)

        val import = uploadCard(row(1, "CAFE SANTO DOMINGO", "100.00"), row(2, "TIENDA NUEVA", "300.00"))

        assertEquals(1, savedEntries.size)
        assertNotNull(import.lines[0].journalLine)
        assertNull(import.lines[1].journalLine)
        assertEquals(StatementImportStatus.PENDING_REVIEW, import.status)
    }

    @Test
    fun `upload where every row matches is confirmed`() {
        knownMerchant("CAFE", food)

        val import = uploadCard(row(1, "CAFE A", "100.00"), row(2, "CAFE B", "150.00"))

        assertEquals(2, savedEntries.size)
        assertEquals(StatementImportStatus.CONFIRMED, import.status)
    }

    @Test
    fun `a parse error records the import as failed`() {
        `when`(cardParser.parse(any(InputStream::class.java) ?: InputStream.nullInputStream()))
            .thenThrow(IllegalStateException("not a BHD statement"))
        var saved: StatementImport? = null
        `when`(importRepo.save(any(StatementImport::class.java)))
            .thenAnswer { (it.arguments[0] as StatementImport).also { i -> saved = i } }

        val response = service.upload(
            MockMultipartFile("file", ByteArray(0)), 2L, ApiStatementType.CREDIT_CARD, LocalDate.of(2026, 8, 26)
        )

        assertEquals(StatementImportStatus.FAILED, saved!!.status)
        assertEquals("not a BHD statement", response.errorMessage)
        assertEquals(0, savedEntries.size)
    }
}
