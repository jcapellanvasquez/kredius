package com.kredius.be.service

import com.kredius.be.entity.*
import com.kredius.be.entity.StatementImportStatus
import com.kredius.be.exception.ApiException
import com.kredius.be.model.*
import com.kredius.be.model.StatementType
import com.kredius.be.parser.BhdPdfParser
import com.kredius.be.parser.BhdSavingsPdfParser
import com.kredius.be.parser.ParsedStatementRow
import com.kredius.be.parser.RowDirection
import com.kredius.be.repository.*
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.math.BigDecimal
import java.time.LocalDate
import com.kredius.be.entity.StatementType as EntityStatementType
import com.kredius.be.model.StatementImportStatus as ApiStatus
import com.kredius.be.model.StatementType as ApiStatementType

@Service
@Transactional
class StatementService(
    private val currentUser: CurrentUserService,
    private val accountRepo: AccountRepository,
    private val importRepo: StatementImportRepository,
    private val lineRepo: StatementLineRepository,
    private val merchantRepo: MerchantDictionaryRepository,
    private val journalEntryRepo: JournalEntryRepository,
    private val exchangeRateRepo: ExchangeRateRepository,
    private val parser: BhdPdfParser,
    private val savingsParser: BhdSavingsPdfParser,
    private val journalService: JournalService,
) {
    /**
     * Stores the statement's new rows and posts the ones the merchant dictionary categorizes, in one
     * transaction: a posting failure rolls back the whole upload. Only a parse error is recorded, as FAILED.
     */
    @Transactional
    fun upload(file: MultipartFile, accountId: Long, type: StatementType, statementDate: LocalDate): StatementImportResponse {
        val userId = currentUser.id
        val account = accountRepo.findByIdAndUserId(accountId, userId)
            ?: throw ApiException(ApiException.NOT_FOUND, "Account not found", HttpStatus.NOT_FOUND)

        val import = importRepo.save(
            StatementImport(
                account = account,
                type = com.kredius.be.entity.StatementType.valueOf(type.value),
                statementDate = statementDate,
                fileName = file.originalFilename,
                status = StatementImportStatus.UPLOADED,
                user = currentUser.user,
            )
        )

        val rows = try {
            when (type) {
                ApiStatementType.SAVINGS -> savingsParser.parse(file.inputStream)
                else -> parser.parse(file.inputStream)
            }
        } catch (ex: Exception) {
            import.status = StatementImportStatus.FAILED
            import.errorMessage = ex.message?.take(500)
            return importRepo.save(import).toResponse()
        }

        val merchants = merchantRepo.findByUserIdOrderByTextPatternAsc(userId)
            .associateBy { it.textPattern.uppercase() }

        fun matchAccount(description: String) = merchants.entries
            .firstOrNull { (pattern, _) -> description.uppercase().contains(pattern) }
            ?.value?.account

        val existingKeys = existingKeys(account.id, rows)
        val lines = rows.filter { it.dedupKey() !in existingKeys }.map { row ->
            val exclusion = row.exclusionReason(import.type)
            StatementLine(
                statementImport = import,
                account = account,
                lineDate = row.date,
                description = row.description,
                currency = row.currency,
                amount = row.amount,
                type = row.lineType(),
                categoryAccount = if (exclusion != null) null else matchAccount(row.description),
                occurrenceIndex = row.occurrenceIndex,
            ).apply { exclusion?.let(::exclude) }
        }
        import.lines.addAll(lines)
        importRepo.save(import)

        val autoPosted = postPending(import)
        return importRepo.save(import).toResponse(autoPostedCount = autoPosted)
    }

    /** What makes a row the same transaction; mirrors the unique constraint on `statement_lines`. */
    private data class DedupKey(
        val date: LocalDate,
        val description: String,
        val amount: BigDecimal,
        val currency: CurrencyType,
        val occurrenceIndex: Int,
    )

    private fun ParsedStatementRow.dedupKey() =
        DedupKey(date, description, amount.setScale(2), currency, occurrenceIndex)

    private fun StatementLine.dedupKey() =
        DedupKey(lineDate, description, amount.setScale(2), currency, occurrenceIndex)

    private fun existingKeys(accountId: Long, rows: List<ParsedStatementRow>): Set<DedupKey> {
        if (rows.isEmpty()) return emptySet()
        return lineRepo.findByAccountIdAndLineDateBetween(accountId, rows.minOf { it.date }, rows.maxOf { it.date })
            .mapTo(HashSet()) { it.dedupKey() }
    }

    /**
     * Rows stored but never posted. A card payment (the card's only CREDIT row) is posted from the
     * savings statement, where the dictionary maps `PAGO DE TC` to the card; posting both would count it twice.
     */
    private fun ParsedStatementRow.exclusionReason(type: EntityStatementType) = when {
        isInitialBalance -> ExclusionReason.INITIAL_BALANCE
        type == EntityStatementType.CREDIT_CARD && direction == RowDirection.CREDIT ->
            ExclusionReason.CARD_PAYMENT_AVOID_DOUBLE_ENTRY
        else -> null
    }

    private fun ParsedStatementRow.lineType() = when {
        isInitialBalance -> StatementLineType.INITIAL_BALANCE
        direction == RowDirection.CREDIT -> StatementLineType.CREDIT
        else -> StatementLineType.DEBIT
    }

    fun patchLine(id: Long, request: PatchStatementLineRequest): StatementLineDto {
        val line = lineRepo.findByIdAndStatementImportUserId(id, currentUser.id)
            ?: throw ApiException(ApiException.NOT_FOUND, "Statement line not found", HttpStatus.NOT_FOUND)

        request.isExcluded?.let { line.isExcluded = it }
        request.categoryAccountId?.let { accId ->
            val account = accountRepo.findByIdAndUserId(accId, currentUser.id)
                ?: throw ApiException(ApiException.NOT_FOUND, "Category account not found", HttpStatus.NOT_FOUND)
            line.categoryAccount = account
            learnMerchant(line.description, account)
        }
        if (request.categoryAccountId == null && request.isExcluded == null) {
            throw ApiException(ApiException.BAD_REQUEST, "Nothing to update", HttpStatus.BAD_REQUEST)
        }

        return lineRepo.save(line).toDto()
    }

    private fun learnMerchant(description: String, account: Account) {
        val pattern = extractPattern(description)
        val existing = merchantRepo.findByUserIdAndTextPattern(currentUser.id, pattern)
        if (existing == null) {
            merchantRepo.save(
                MerchantDictionary(
                    textPattern = pattern,
                    account = account,
                    user = currentUser.user,
                )
            )
        } else if (existing.account.id != account.id) {
            existing.account = account
            existing.updatedAt = java.time.OffsetDateTime.now()
            merchantRepo.save(existing)
        }
    }

    private fun extractPattern(description: String): String {
        // Credit card descriptions often embed a transaction reference after # or *
        // e.g. "BRAVOVA #8820738 SANTODOMINGO-DO" → "BRAVOVA"
        //      "AMAZON*PRIME"                     → "AMAZON"
        for (separator in listOf("#", "*")) {
            val before = description.substringBefore(separator).trim()
            if (before.isNotBlank() && before != description.trim()) return before
        }
        return description.trim()
    }

    @Transactional
    fun confirm(id: Long): ResponseEntity<*> {
        val importStatement = importRepo.findByIdAndUserId(id, currentUser.id)
            ?: throw ApiException(ApiException.NOT_FOUND, "Statement import not found", HttpStatus.NOT_FOUND)

        val postedCount = postPending(importStatement)
        importRepo.saveAndFlush(importStatement)

        return ResponseEntity.ok(ConfirmImportResponse(
            id = importStatement.id,
            status = ApiStatus.valueOf(importStatement.status.name),
            postedEntries = postedCount,
        ))
    }

    /**
     * Posts every categorized line that isn't posted yet, then sets the import to CONFIRMED when no
     * non-excluded line is left unposted, PENDING_REVIEW otherwise. Returns how many lines were posted.
     */
    private fun postPending(import: StatementImport): Int {
        val usdRate = exchangeRateRepo.findTopByContextOrderByRateDateDesc(RateContext.CREDIT_CARD)
        val pending = import.lines.filter { isNewJournalEntry(it) }
        for (line in pending) {
            line.journalLine = journalService.saveJournalLine(
                line = line, importStatement = import, source = import.journalSource(),
                amountRd = amountRd(line, usdRate), usdRate = usdRate, currentUser = currentUser.user)
        }
        val allPosted = import.lines.filter { !it.isExcluded }.all { it.journalLine != null }
        import.status = if (allPosted) StatementImportStatus.CONFIRMED else StatementImportStatus.PENDING_REVIEW
        return pending.size
    }

    /** The line's amount in RD$; USD lines use the latest credit-card rate. */
    private fun amountRd(line: StatementLine, usdRate: ExchangeRate?): BigDecimal =
        if (line.currency == CurrencyType.RD) line.amount
        else line.amount.multiply(usdRate?.value ?: BigDecimal.ONE)

    private fun StatementImport.journalSource() =
        if (type == EntityStatementType.CREDIT_CARD) JournalSource.CARD_STATEMENT else JournalSource.SAVINGS_STATEMENT

    fun reverse(id: Long): StatementImportResponse {
        val import = importRepo.findByIdAndUserId(id, currentUser.id)
            ?: throw ApiException(ApiException.NOT_FOUND, "Statement import not found", HttpStatus.NOT_FOUND)

        if (import.status != StatementImportStatus.CONFIRMED)
            throw ApiException(ApiException.CONFLICT, "Import is not in CONFIRMED status", HttpStatus.CONFLICT)

        val source = import.journalSource()
        val originals = journalEntryRepo.findByReferenceIdAndSource(import.id, source)
        for (original in originals) {
            val reversal = journalEntryRepo.save(
                JournalEntry(
                    entryDate = LocalDate.now(),
                    description = "REVERSAL: ${original.description}",
                    source = source,
                    referenceId = import.id,
                    reversesEntry = original,
                    user = currentUser.user,
                )
            )
            val mirroredLines = original.lines.map { orig ->
                JournalLine(
                    journalEntry = reversal,
                    account = orig.account,
                    side = if (orig.side == EntrySide.DEBIT) EntrySide.CREDIT else EntrySide.DEBIT,
                    currency = orig.currency,
                    originalAmount = orig.originalAmount,
                    exchangeRate = orig.exchangeRate,
                    amountRd = orig.amountRd,
                )
            }
            reversal.lines.addAll(mirroredLines)
            journalEntryRepo.save(reversal)
        }

        import.status = StatementImportStatus.REVERSED
        importRepo.save(import)
        return import.toResponse()
    }

    @Transactional(readOnly = true)
    fun list(): List<StatementImportSummaryResponse> =
        importRepo.findByUserIdOrderByStatementDateDesc(currentUser.id).map { it.toSummary() }

    @Transactional(readOnly = true)
    fun get(id: Long): StatementImportResponse {
        val import = importRepo.findByIdAndUserId(id, currentUser.id)
            ?: throw ApiException(ApiException.NOT_FOUND, "Statement import not found", HttpStatus.NOT_FOUND)
        return import.toResponse()
    }

    private fun StatementImport.toSummary() = StatementImportSummaryResponse(
        id = id,
        status = ApiStatus.valueOf(status.name),
        type = ApiStatementType.valueOf(type.name),
        statementDate = statementDate,
        accountId = account.id,
        accountName = account.name,
        lineCount = lines.count { it.type != StatementLineType.INITIAL_BALANCE },
        unresolvedCount = lines.count { it.isUncategorized() },
    )

    private fun StatementImport.toResponse(autoPostedCount: Int? = null) = StatementImportResponse(
        id = id,
        status = ApiStatus.valueOf(status.name),
        type = ApiStatementType.valueOf(type.name),
        statementDate = statementDate,
        accountId = account.id,
        accountName = account.name,
        errorMessage = errorMessage,
        uploadedAt = createdAt,
        newCount = lines.count { it.type != StatementLineType.INITIAL_BALANCE },
        uncategorizedCount = lines.count { it.isUncategorized() },
        autoPostedCount = autoPostedCount,
        lines = lines.map { it.toDto() },
    )

    private fun StatementLine.toDto() = StatementLineDto(
        id = id,
        lineDate = lineDate,
        description = description,
        currency = StatementLineDto.Currency.valueOf(currency.name),
        amount = amount.toDouble(),
        isExcluded = isExcluded,
        isPayment = exclusionReason == ExclusionReason.CARD_PAYMENT_AVOID_DOUBLE_ENTRY,
        exclusionReason = exclusionReason?.let { StatementLineDto.ExclusionReason.valueOf(it.name) },
        lineType = type?.name?.let { StatementLineDto.LineType.valueOf(it) },
        categoryAccountId = categoryAccount?.id,
        categoryAccountName = categoryAccount?.name,
    )

    /** A line is posted once: `journalLine` is set when it is, so re-confirming skips it. */
    private fun StatementLine.isUncategorized() =
        !isExcluded && categoryAccount == null && type != StatementLineType.INITIAL_BALANCE

    private fun isNewJournalEntry(row: StatementLine): Boolean {
        return !row.isExcluded && row.categoryAccount != null && row.journalLine == null
    }
}
