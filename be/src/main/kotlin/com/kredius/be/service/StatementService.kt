package com.kredius.be.service

import com.kredius.be.entity.*
import com.kredius.be.entity.StatementImportStatus
import com.kredius.be.exception.ApiException
import com.kredius.be.exception.DuplicateImportException
import com.kredius.be.model.*
import com.kredius.be.model.StatementType
import com.kredius.be.parser.BhdPdfParser
import com.kredius.be.parser.BhdSavingsPdfParser
import com.kredius.be.parser.ParsedSavingsStatementLine
import com.kredius.be.repository.*
import org.slf4j.LoggerFactory
import org.springframework.dao.DataIntegrityViolationException
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
    @Transactional
    fun upload(file: MultipartFile, accountId: Long, type: StatementType, statementDate: LocalDate): StatementImportResponse {
        val userId = currentUser.id
        val account = accountRepo.findByIdAndUserId(accountId, userId)
            ?: throw ApiException(ApiException.NOT_FOUND, "Account not found", HttpStatus.NOT_FOUND)

        val existingStatementOfMonth = importRepo.findByAccountIdAndStatementDateMonth(accountId, statementDate.monthValue)
        if (existingStatementOfMonth != null) return existingStatementOfMonth.toResponse()

        val import = StatementImport(
            account = account,
            type = com.kredius.be.entity.StatementType.valueOf(type.value),
            statementDate = statementDate,
            fileName = file.originalFilename,
            status = StatementImportStatus.UPLOADED,
            user = currentUser.user,
        )
        importRepo.save(import)

        return try {
            importRepo.save(import)

            val merchants = merchantRepo.findByUserIdOrderByTextPatternAsc(userId)
                .associateBy { it.textPattern.uppercase() }

            fun matchAccount(description: String) = merchants.entries
                .firstOrNull { (pattern, _) -> description.uppercase().contains(pattern) }
                ?.value?.account

            val lines = when (type) {
                ApiStatementType.SAVINGS -> savingsParser.parse(file.inputStream)
                    .map { row ->
                        val lineType = when {
                            row.isInitialBalance -> StatementLineType.INITIAL_BALANCE
                            row.credit > BigDecimal.ZERO -> StatementLineType.CREDIT
                            else -> StatementLineType.DEBIT
                        }

                        StatementLine(
                            statementImport = import,
                            lineDate = row.transactionDate,
                            description = row.description,
                            currency = row.currency,
                            amount = row.amount,
                            isExcluded = row.isInitialBalance,
                            type = lineType,
                            categoryAccount = if (row.isInitialBalance) null else matchAccount(row.description),
                            occurrenceIndex = row.occurrenceIndex,
                        )
                    }

                else -> parser.parse(file.inputStream).map { row ->
                    StatementLine(
                        statementImport = import,
                        lineDate = row.transactionDate,
                        description = row.description,
                        currency = row.currency,
                        amount = row.amount,
                        isExcluded = false,
                        type = if (row.isPayment) StatementLineType.CREDIT else StatementLineType.DEBIT,
                        categoryAccount = matchAccount(row.description),
                        occurrenceIndex = row.occurrenceIndex,
                    )
                }
            }
            import.lines.addAll(lines)

            import.status = StatementImportStatus.PENDING_REVIEW
            importRepo.save(import)
            import.toResponse()
        } catch (ex: Exception) {
            import.status = StatementImportStatus.FAILED
            import.errorMessage = ex.message?.take(500)
            importRepo.save(import)
            import.toResponse()
        }
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

        var postedCount = 0
        // Race-condition duplicate check
        val existing = importRepo.findByAccountIdAndStatementDateAndStatus(
            importStatement.account.id, importStatement.statementDate, StatementImportStatus.CONFIRMED
        )
        if (existing != null && existing.id != id) throw DuplicateImportException(existing.id)

        val source = if (importStatement.type == EntityStatementType.CREDIT_CARD)
            JournalSource.CARD_STATEMENT else JournalSource.SAVINGS_STATEMENT

        val usdRate = exchangeRateRepo.findTopByContextOrderByRateDateDesc(RateContext.CREDIT_CARD)
        val journalEntryList = journalEntryRepo.findByReferenceIdAndSource(importStatement.id, source)

        for (line in importStatement.lines.filter { line -> isNewJournalEntry(line) }) {
            try {
                val amountRd = if (line.currency == CurrencyType.RD) line.amount
                else line.amount.multiply(usdRate?.value ?: BigDecimal.ONE)

                line.journalLine = journalService.saveJournalLine(
                    line = line, importStatement = importStatement, source = source, amountRd = amountRd,
                    usdRate = usdRate, currentUser = currentUser.user)
                postedCount++
            } catch (ex: DataIntegrityViolationException) {
                LOGGER.warn("Skipping duplicate entry for line occurrence ${line.occurrenceIndex}: ${ex.message}")
                continue
            }
        }

        val journalLinesCount = journalEntryList.size + postedCount
        importStatement.status = if (importStatement.lines.filter { !it.isExcluded  }.size == journalLinesCount) StatementImportStatus.CONFIRMED else StatementImportStatus.PENDING_REVIEW
        importRepo.saveAndFlush(importStatement)

        return ResponseEntity.ok(ConfirmImportResponse(id = importStatement.id, status = ApiStatus.CONFIRMED, postedEntries = postedCount))
    }

    fun reverse(id: Long): StatementImportResponse {
        val import = importRepo.findByIdAndUserId(id, currentUser.id)
            ?: throw ApiException(ApiException.NOT_FOUND, "Statement import not found", HttpStatus.NOT_FOUND)

        if (import.status != StatementImportStatus.CONFIRMED)
            throw ApiException(ApiException.CONFLICT, "Import is not in CONFIRMED status", HttpStatus.CONFLICT)

        val source = if (import.type == EntityStatementType.CREDIT_CARD)
            JournalSource.CARD_STATEMENT else JournalSource.SAVINGS_STATEMENT

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
        unresolvedCount = lines.count { !it.isExcluded && it.categoryAccount == null && it.type != StatementLineType.INITIAL_BALANCE },
    )

    private fun StatementImport.toResponse() = StatementImportResponse(
        id = id,
        status = ApiStatus.valueOf(status.name),
        type = ApiStatementType.valueOf(type.name),
        statementDate = statementDate,
        accountId = account.id,
        accountName = account.name,
        errorMessage = errorMessage,
        lines = lines.map { it.toDto() },
    )

    private fun StatementLine.toDto() = StatementLineDto(
        id = id,
        lineDate = lineDate,
        description = description,
        currency = StatementLineDto.Currency.valueOf(currency.name),
        amount = amount.toDouble(),
        isExcluded = isExcluded,
        lineType = type?.name?.let { StatementLineDto.LineType.valueOf(it) },
        categoryAccountId = categoryAccount?.id,
        categoryAccountName = categoryAccount?.name,
    )

    private fun isNewJournalEntry(row: StatementLine): Boolean {
        return !row.isExcluded && row.categoryAccount != null
    }

    companion object {
        private val LOGGER = LoggerFactory.getLogger(StatementService::class.java)
    }
}
