package com.kredius.be.service

import com.kredius.be.entity.Account
import com.kredius.be.entity.AccountType
import com.kredius.be.entity.CorrectionType
import com.kredius.be.entity.CurrencyType
import com.kredius.be.entity.EntrySide
import com.kredius.be.entity.ExclusionReason
import com.kredius.be.entity.JournalEntry
import com.kredius.be.entity.JournalLine
import com.kredius.be.entity.JournalSource
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
import com.kredius.be.exception.ApiException
import com.kredius.be.model.PatchStatementLineRequest
import com.kredius.be.model.RecategorizeStatementLineRequest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.http.HttpStatus
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
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import com.kredius.be.model.StatementType as ApiStatementType

class StatementServiceTest {

    private val savings = Account(id = 1, name = "Ahorros", type = AccountType.ASSET)
    private val card = Account(id = 2, name = "Tarjeta", type = AccountType.LIABILITY)
    private val food = Account(id = 6, name = "Comida", type = AccountType.EXPENSE)
    private val market = Account(id = 7, name = "Supermercado", type = AccountType.EXPENSE)
    private val leisure = Account(id = 8, name = "Diversión", type = AccountType.EXPENSE)

    private val savedEntries = mutableListOf<JournalEntry>()
    private val savedJournalLines = mutableListOf<JournalLine>()
    private val storedLines = mutableListOf<StatementLine>()
    private val importRepo = mock(StatementImportRepository::class.java)
    private val cardParser = mock(BhdPdfParser::class.java)
    private val savingsParser = mock(BhdSavingsPdfParser::class.java)
    private val merchantRepo = mock(MerchantDictionaryRepository::class.java)
    private val statementLineRepo = mock(StatementLineRepository::class.java)
    private val entryRepo = mock(JournalEntryRepository::class.java)

    private val service = run {
        val userRepo = mock(UserRepository::class.java)
        `when`(userRepo.findById(0L)).thenReturn(Optional.of(User()))
        val accountRepo = mock(AccountRepository::class.java)
        `when`(accountRepo.findByIdAndUserId(1L, 0L)).thenReturn(savings)
        `when`(accountRepo.findByIdAndUserId(2L, 0L)).thenReturn(card)
        `when`(accountRepo.findByIdAndUserId(6L, 0L)).thenReturn(food)
        `when`(accountRepo.findByIdAndUserId(7L, 0L)).thenReturn(market)
        `when`(accountRepo.findByIdAndUserId(8L, 0L)).thenReturn(leisure)
        `when`(importRepo.save(any(StatementImport::class.java))).thenAnswer { it.arguments[0] }
        `when`(statementLineRepo.save(any(StatementLine::class.java))).thenAnswer { it.arguments[0] }
        `when`(statementLineRepo.findByAccountIdAndLineDateBetween(anyLong(), anyDate(), anyDate()))
            .thenAnswer { storedLines.toList() }
        `when`(entryRepo.save(any(JournalEntry::class.java)))
            .thenAnswer { (it.arguments[0] as JournalEntry).also { e -> if (savedEntries.none { it === e }) savedEntries += e } }
        `when`(entryRepo.findByReferenceIdAndSource(anyLong(), any(JournalSource::class.java) ?: JournalSource.MANUAL))
            .thenAnswer { inv -> savedEntries.filter { it.referenceId == inv.arguments[0] && it.source == inv.arguments[1] } }
        val lineRepo = mock(JournalLineRepository::class.java)
        `when`(lineRepo.save(any(JournalLine::class.java)))
            .thenAnswer { (it.arguments[0] as JournalLine).also(savedJournalLines::add) }
        `when`(lineRepo.saveAndFlush(any(JournalLine::class.java)))
            .thenAnswer { (it.arguments[0] as JournalLine).also(savedJournalLines::add) }

        StatementService(
            currentUser = CurrentUserService(userRepo, 0L),
            accountRepo = accountRepo,
            importRepo = importRepo,
            lineRepo = statementLineRepo,
            merchantRepo = merchantRepo,
            journalEntryRepo = entryRepo,
            exchangeRateRepo = mock(ExchangeRateRepository::class.java),
            parser = cardParser,
            savingsParser = savingsParser,
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

    private fun row(
        day: Int,
        description: String,
        amount: String,
        occurrence: Int = 1,
        direction: RowDirection = RowDirection.DEBIT,
    ) = ParsedStatementRow(
        date = LocalDate.of(2026, 8, day),
        description = description,
        amount = BigDecimal(amount),
        currency = CurrencyType.RD,
        direction = direction,
        occurrenceIndex = occurrence,
    )

    /** Uploads [rows] as a card statement and keeps its lines as the account's stored lines. */
    private fun uploadCard(vararg rows: ParsedStatementRow): StatementImport {
        `when`(cardParser.parse(any(InputStream::class.java) ?: InputStream.nullInputStream())).thenReturn(rows.toList())
        return upload(card, ApiStatementType.CREDIT_CARD)
    }

    private fun uploadSavings(vararg rows: ParsedStatementRow): StatementImport {
        `when`(savingsParser.parse(any(InputStream::class.java) ?: InputStream.nullInputStream())).thenReturn(rows.toList())
        return upload(savings, ApiStatementType.SAVINGS)
    }

    private fun upload(account: Account, type: ApiStatementType): StatementImport {
        var saved: StatementImport? = null
        `when`(importRepo.save(any(StatementImport::class.java)))
            .thenAnswer { (it.arguments[0] as StatementImport).also { i -> saved = i } }
        service.upload(MockMultipartFile("file", ByteArray(0)), account.id, type, LocalDate.of(2026, 8, 26))
        return saved!!.also { imp -> storedLines += imp.lines.filter { it.account === account } }
    }

    private fun knownMerchant(pattern: String, account: Account) {
        `when`(merchantRepo.findByUserIdOrderByTextPatternAsc(0L))
            .thenReturn(listOf(MerchantDictionary(textPattern = pattern, account = account)))
    }

    private fun patch(line: StatementLine, categoryAccountId: Long? = null, isExcluded: Boolean? = null) {
        `when`(statementLineRepo.findByIdAndStatementImportUserId(anyLong(), anyLong())).thenReturn(line)
        service.patchLine(line.id, PatchStatementLineRequest(categoryAccountId = categoryAccountId, isExcluded = isExcluded))
    }

    private fun recategorize(line: StatementLine, categoryAccountId: Long) {
        `when`(statementLineRepo.findByIdAndStatementImportUserId(anyLong(), anyLong())).thenReturn(line)
        service.recategorize(line.id, RecategorizeStatementLineRequest(categoryAccountId))
    }

    private fun assertStatus(status: HttpStatus, block: () -> Unit) =
        assertEquals(status, assertThrows<ApiException> { block() }.httpStatus)

    private fun assertConflict(block: () -> Unit) = assertStatus(HttpStatus.CONFLICT, block)

    /** Each account's DR − CR over the lines of every entry saved so far, keyed by account name. */
    private fun netByAccount() = savedEntries.flatMap { it.lines }.groupBy { it.account.name }.mapValues { (_, lines) ->
        lines.sumOf { if (it.side == EntrySide.DEBIT) it.amountRd else it.amountRd.negate() }
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

    @Test
    fun `a card payment on both statements is posted once, from savings`() {
        knownMerchant("PAGO DE TC", card)

        val cardImport = uploadCard(
            row(15, "PAGO DEBITO A CUENTA MBP", "10000.00", direction = RowDirection.CREDIT),
            row(16, "CAFE", "100.00"),
        )
        uploadSavings(row(17, "PAGO DE TC 4641 3300 0032 7971", "10000.00"))

        val payment = cardImport.lines[0]
        assertEquals(ExclusionReason.CARD_PAYMENT_AVOID_DOUBLE_ENTRY, payment.exclusionReason)
        assertNull(payment.categoryAccount)
        assertEquals(1, savedEntries.size)
        val sides = savedJournalLines.associate { it.account.name to it.side }
        assertEquals(mapOf("Tarjeta" to EntrySide.DEBIT, "Ahorros" to EntrySide.CREDIT), sides)
    }

    @Test
    fun `categorizing an unposted line posts it and confirms the import on the last one`() {
        val import = cardImport(null, null)

        patch(import.lines[0], categoryAccountId = food.id)
        assertEquals(1, savedEntries.size)
        assertEquals(StatementImportStatus.PENDING_REVIEW, import.status)

        patch(import.lines[1], categoryAccountId = market.id)
        assertEquals(2, savedEntries.size)
        assertEquals(market, import.lines[1].categoryAccount)
        assertEquals(StatementImportStatus.CONFIRMED, import.status)
    }

    @Test
    fun `excluding the last pending line confirms the import, and including it clears the reason`() {
        val import = cardImport(food, null)
        service.confirm(1)

        patch(import.lines[1], isExcluded = true)
        assertTrue(import.lines[1].isExcluded)
        assertEquals(ExclusionReason.USER_EXCLUDED, import.lines[1].exclusionReason)
        assertEquals(StatementImportStatus.CONFIRMED, import.status)

        patch(import.lines[1], isExcluded = false)
        assertFalse(import.lines[1].isExcluded)
        assertNull(import.lines[1].exclusionReason)
        assertEquals(StatementImportStatus.PENDING_REVIEW, import.status)
    }

    @Test
    fun `a posted line can't be recategorized or excluded through patch`() {
        val import = cardImport(food)
        service.confirm(1)
        val posted = import.lines[0]

        assertConflict { patch(posted, categoryAccountId = market.id) }
        assertConflict { patch(posted, isExcluded = true) }
        patch(posted, categoryAccountId = food.id) // same category: nothing to do
        assertEquals(1, savedEntries.size)
    }

    @Test
    fun `lines of a reversed import can't be patched or confirmed`() {
        val import = cardImport(null)
        import.status = StatementImportStatus.REVERSED

        assertConflict { patch(import.lines[0], categoryAccountId = food.id) }
        assertConflict { service.confirm(1) }
        assertEquals(0, savedEntries.size)
    }

    @Test
    fun `recategorizing a posted line adds a correction entry and keeps the original`() {
        val import = cardImport(food)
        import.lines[0].lineDate = LocalDate.of(2026, 7, 30)
        service.confirm(1)
        val original = savedEntries.single()

        recategorize(import.lines[0], market.id)

        val correction = savedEntries.last()
        assertEquals(2, savedEntries.size)
        assertEquals(CorrectionType.RECATEGORIZATION, correction.correctionType)
        assertEquals(LocalDate.of(2026, 7, 30), correction.entryDate)
        assertEquals(original.referenceId, correction.referenceId)
        assertEquals(original.source, correction.source)
        assertEquals("Recategorización: Comida → Supermercado", correction.description)
        assertEquals(
            mapOf("Supermercado" to EntrySide.DEBIT, "Comida" to EntrySide.CREDIT),
            correction.lines.associate { it.account.name to it.side },
        )
        assertEquals(market, import.lines[0].categoryAccount)
        val net = netByAccount()
        assertEquals(0, net.getValue("Comida").signum())
        assertEquals(BigDecimal("100.00"), net.getValue("Supermercado"))
        assertEquals(BigDecimal("-100.00"), net.getValue("Tarjeta"))
    }

    @Test
    fun `a chain of recategorizations nets out on the last category`() {
        val import = cardImport(food)
        service.confirm(1)

        recategorize(import.lines[0], market.id)
        recategorize(import.lines[0], leisure.id)

        val net = netByAccount()
        assertEquals(0, net.getValue("Comida").signum())
        assertEquals(0, net.getValue("Supermercado").signum())
        assertEquals(BigDecimal("100.00"), net.getValue("Diversión"))
        assertEquals(BigDecimal("-100.00"), net.getValue("Tarjeta"))
    }

    @Test
    fun `recategorize rejects unknown, unposted, reversed and unchanged lines`() {
        `when`(statementLineRepo.findByIdAndStatementImportUserId(anyLong(), anyLong())).thenReturn(null)
        assertStatus(HttpStatus.NOT_FOUND) { service.recategorize(99, RecategorizeStatementLineRequest(market.id)) }

        val import = cardImport(null, food)
        assertConflict { recategorize(import.lines[0], market.id) }

        service.confirm(1)
        assertStatus(HttpStatus.BAD_REQUEST) { recategorize(import.lines[1], food.id) }

        import.status = StatementImportStatus.REVERSED
        assertConflict { recategorize(import.lines[1], market.id) }
        assertEquals(1, savedEntries.size)
    }

    @Test
    fun `reversing after a recategorization nets every account to zero`() {
        val import = cardImport(food, null)
        service.confirm(1)
        recategorize(import.lines[0], market.id)

        service.reverse(1)

        val reversals = savedEntries.filter { it.correctionType == CorrectionType.REVERSAL }
        assertEquals(2, reversals.size)
        assertTrue(netByAccount().values.all { it.signum() == 0 }, "net by account: ${netByAccount()}")
        assertEquals(StatementImportStatus.REVERSED, import.status)
    }

    @Test
    fun `reverse refuses an import that is already reversed`() {
        val import = cardImport(food)
        service.confirm(1)
        service.reverse(1)

        assertConflict { service.reverse(1) }
        assertEquals(StatementImportStatus.REVERSED, import.status)
    }
}
