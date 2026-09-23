package com.kredius.be.service

import com.kredius.be.entity.CurrencyType
import com.kredius.be.entity.EntrySide
import com.kredius.be.entity.JournalEntry
import com.kredius.be.entity.JournalLine
import com.kredius.be.entity.JournalSource
import com.kredius.be.entity.RateContext
import com.kredius.be.entity.StatementImport
import com.kredius.be.entity.StatementImportStatus
import com.kredius.be.entity.StatementLine
import com.kredius.be.entity.StatementLineType
import com.kredius.be.entity.StatementType as EntityStatementType
import com.kredius.be.exception.ApiException
import com.kredius.be.exception.DuplicateImportException
import com.kredius.be.model.ConfirmImportResponse
import com.kredius.be.model.PatchStatementLineRequest
import com.kredius.be.model.StatementImportResponse
import com.kredius.be.model.StatementImportStatus as ApiStatus
import com.kredius.be.model.StatementImportSummaryResponse
import com.kredius.be.model.StatementLineDto
import com.kredius.be.model.StatementType
import com.kredius.be.model.StatementType as ApiStatementType
import com.kredius.be.model.UnresolvedLinesError
import com.kredius.be.parser.BhdPdfParser
import com.kredius.be.parser.BhdSavingsPdfParser
import com.kredius.be.repository.AccountRepository
import com.kredius.be.repository.ExchangeRateRepository
import com.kredius.be.repository.JournalEntryRepository
import com.kredius.be.repository.JournalLineRepository
import com.kredius.be.entity.MerchantDictionary
import com.kredius.be.repository.MerchantDictionaryRepository
import com.kredius.be.repository.StatementImportRepository
import com.kredius.be.repository.StatementLineRepository
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.math.BigDecimal
import java.time.LocalDate

@Service
@Transactional
class StatementService(
    private val currentUser: CurrentUserService,
    private val accountRepo: AccountRepository,
    private val importRepo: StatementImportRepository,
    private val lineRepo: StatementLineRepository,
    private val merchantRepo: MerchantDictionaryRepository,
    private val journalEntryRepo: JournalEntryRepository,
    private val journalLineRepo: JournalLineRepository,
    private val exchangeRateRepo: ExchangeRateRepository,
    private val parser: BhdPdfParser,
    private val savingsParser: BhdSavingsPdfParser,
) {
    fun upload(file: MultipartFile, accountId: Long, type: StatementType, statementDate: LocalDate): StatementImportResponse {
        val userId  = currentUser.id
        val account = accountRepo.findByIdAndUserId(accountId, userId)
            ?: throw ApiException("NOT_FOUND", "Account not found", HttpStatus.NOT_FOUND)

        // Duplicate check: reject if a CONFIRMED import already exists
        val existing = importRepo.findByAccountIdAndStatementDateAndStatus(accountId, statementDate, StatementImportStatus.CONFIRMED)
        if (existing != null) throw DuplicateImportException(existing.id)

        val import = StatementImport(
            account       = account,
            type          = com.kredius.be.entity.StatementType.valueOf(type.value),
            statementDate = statementDate,
            fileName      = file.originalFilename,
            status        = StatementImportStatus.UPLOADED,
            user          = currentUser.user,
        )
        importRepo.save(import)

        return try {
            import.status = StatementImportStatus.PROCESSING
            importRepo.save(import)

            val merchants = merchantRepo.findByUserIdOrderByTextPatternAsc(userId)
                .associateBy { it.textPattern.uppercase() }

            fun matchAccount(description: String) = merchants.entries
                .firstOrNull { (pattern, _) -> description.uppercase().contains(pattern) }
                ?.value?.account

            val lines = when (type) {
                ApiStatementType.SAVINGS -> savingsParser.parse(file.inputStream).map { row ->
                    val lineType = when {
                        row.isInitialBalance          -> StatementLineType.INITIAL_BALANCE
                        row.credit > java.math.BigDecimal.ZERO -> StatementLineType.CREDIT
                        else                          -> StatementLineType.DEBIT
                    }
                    StatementLine(
                        statementImport = import,
                        lineDate        = row.transactionDate,
                        description     = row.description,
                        currency        = row.currency,
                        amount          = row.amount,
                        isExcluded      = row.isInitialBalance,
                        type            = lineType,
                        categoryAccount = if (row.isInitialBalance) null else matchAccount(row.description),
                    )
                }
                else -> parser.parse(file.inputStream).map { row ->
                    StatementLine(
                        statementImport = import,
                        lineDate        = row.transactionDate,
                        description     = row.description,
                        currency        = row.currency,
                        amount          = row.amount,
                        isExcluded      = row.isPayment,
                        type            = if (row.isPayment) StatementLineType.CREDIT else StatementLineType.DEBIT,
                        categoryAccount = matchAccount(row.description),
                    )
                }
            }
            import.lines.addAll(lines)

            import.status = StatementImportStatus.PENDING_REVIEW
            importRepo.save(import)
            import.toResponse()
        } catch (ex: Exception) {
            import.status       = StatementImportStatus.FAILED
            import.errorMessage = ex.message?.take(500)
            importRepo.save(import)
            import.toResponse()
        }
    }

    fun patchLine(id: Long, request: PatchStatementLineRequest): StatementLineDto {
        val line = lineRepo.findByIdAndStatementImportUserId(id, currentUser.id)
            ?: throw ApiException("NOT_FOUND", "Statement line not found", HttpStatus.NOT_FOUND)

        request.isExcluded?.let { line.isExcluded = it }
        request.categoryAccountId?.let { accId ->
            val account = accountRepo.findByIdAndUserId(accId, currentUser.id)
                ?: throw ApiException("NOT_FOUND", "Category account not found", HttpStatus.NOT_FOUND)
            line.categoryAccount = account
            learnMerchant(line.description, account)
        }
        if (request.categoryAccountId == null && request.isExcluded == null) {
            throw ApiException("BAD_REQUEST", "Nothing to update", HttpStatus.BAD_REQUEST)
        }

        return lineRepo.save(line).toDto()
    }

    private fun learnMerchant(description: String, account: com.kredius.be.entity.Account) {
        val pattern = extractPattern(description)
        val existing = merchantRepo.findByUserIdAndTextPattern(currentUser.id, pattern)
        if (existing == null) {
            merchantRepo.save(MerchantDictionary(
                textPattern = pattern,
                account     = account,
                user        = currentUser.user,
            ))
        } else if (existing.account.id != account.id) {
            existing.account   = account
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

    fun confirm(id: Long): ResponseEntity<*> {
        val import = importRepo.findByIdAndUserId(id, currentUser.id)
            ?: throw ApiException("NOT_FOUND", "Statement import not found", HttpStatus.NOT_FOUND)

        // Unresolved lines check
        val unresolved = import.lines.filter { !it.isExcluded && it.categoryAccount == null }.map { it.id }
        if (unresolved.isNotEmpty()) {
            return ResponseEntity.unprocessableEntity()
                .body(UnresolvedLinesError(error = "unresolved_lines", lineIds = unresolved))
        }

        // Race-condition duplicate check
        val existing = importRepo.findByAccountIdAndStatementDateAndStatus(
            import.account.id, import.statementDate, StatementImportStatus.CONFIRMED
        )
        if (existing != null && existing.id != id) throw DuplicateImportException(existing.id)

        val source = if (import.type == EntityStatementType.CREDIT_CARD)
            JournalSource.CARD_STATEMENT else JournalSource.SAVINGS_STATEMENT

        val usdRate = exchangeRateRepo.findTopByContextOrderByRateDateDesc(RateContext.CREDIT_CARD)

        var postedCount = 0
        for (line in import.lines.filter { !it.isExcluded }) {
            val amountRd = if (line.currency == CurrencyType.RD) line.amount
                          else line.amount.multiply(usdRate?.value ?: BigDecimal.ONE)

            // Save entry first, then save each JournalLine explicitly and use the returned
            // managed instance. With id: Long = 0 (non-nullable), Spring Data JPA calls
            // em.merge() which returns a NEW managed object — the original local variable
            // stays transient. Explicit saves ensure we hold the managed reference before
            // assigning it to StatementLine.journalLine.
            val savedEntry = journalEntryRepo.save(JournalEntry(
                entryDate   = line.lineDate,
                description = line.description,
                source      = source,
                referenceId = import.id,
                user        = currentUser.user,
            ))
            val managedDebitLine = journalLineRepo.save(JournalLine(
                journalEntry   = savedEntry,
                account        = line.categoryAccount!!,
                side           = EntrySide.DEBIT,
                currency       = line.currency,
                originalAmount = line.amount,
                exchangeRate   = if (line.currency == CurrencyType.USD) usdRate else null,
                amountRd       = amountRd,
            ))
            journalLineRepo.save(JournalLine(
                journalEntry   = savedEntry,
                account        = import.account,
                side           = EntrySide.CREDIT,
                currency       = line.currency,
                originalAmount = line.amount,
                exchangeRate   = if (line.currency == CurrencyType.USD) usdRate else null,
                amountRd       = amountRd,
            ))

            line.journalLine = managedDebitLine
            postedCount++
        }

        import.status = StatementImportStatus.CONFIRMED
        importRepo.save(import)

        return ResponseEntity.ok(ConfirmImportResponse(id = import.id, status = ApiStatus.CONFIRMED, postedEntries = postedCount))
    }

    fun reverse(id: Long): StatementImportResponse {
        val import = importRepo.findByIdAndUserId(id, currentUser.id)
            ?: throw ApiException("NOT_FOUND", "Statement import not found", HttpStatus.NOT_FOUND)

        if (import.status != StatementImportStatus.CONFIRMED)
            throw ApiException("CONFLICT", "Import is not in CONFIRMED status", HttpStatus.CONFLICT)

        val source = if (import.type == EntityStatementType.CREDIT_CARD)
            JournalSource.CARD_STATEMENT else JournalSource.SAVINGS_STATEMENT

        val originals = journalEntryRepo.findByReferenceIdAndSource(import.id, source)
        for (original in originals) {
            val reversal = journalEntryRepo.save(JournalEntry(
                entryDate     = LocalDate.now(),
                description   = "REVERSAL: ${original.description}",
                source        = source,
                referenceId   = import.id,
                reversesEntry = original,
                user          = currentUser.user,
            ))
            val mirroredLines = original.lines.map { orig ->
                JournalLine(
                    journalEntry   = reversal,
                    account        = orig.account,
                    side           = if (orig.side == EntrySide.DEBIT) EntrySide.CREDIT else EntrySide.DEBIT,
                    currency       = orig.currency,
                    originalAmount = orig.originalAmount,
                    exchangeRate   = orig.exchangeRate,
                    amountRd       = orig.amountRd,
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
            ?: throw ApiException("NOT_FOUND", "Statement import not found", HttpStatus.NOT_FOUND)
        return import.toResponse()
    }

    private fun StatementImport.toSummary() = StatementImportSummaryResponse(
        id              = id,
        status          = ApiStatus.valueOf(status.name),
        type            = ApiStatementType.valueOf(type.name),
        statementDate   = statementDate,
        accountId       = account.id,
        accountName     = account.name,
        lineCount       = lines.count { it.type != StatementLineType.INITIAL_BALANCE },
        unresolvedCount = lines.count { !it.isExcluded && it.categoryAccount == null && it.type != StatementLineType.INITIAL_BALANCE },
    )

    private fun StatementImport.toResponse() = StatementImportResponse(
        id            = id,
        status        = ApiStatus.valueOf(status.name),
        type          = ApiStatementType.valueOf(type.name),
        statementDate = statementDate,
        accountId     = account.id,
        accountName   = account.name,
        errorMessage  = errorMessage,
        lines         = lines.map { it.toDto() },
    )

    private fun StatementLine.toDto() = StatementLineDto(
        id                  = id,
        lineDate            = lineDate,
        description         = description,
        currency            = StatementLineDto.Currency.valueOf(currency.name),
        amount              = amount.toDouble(),
        isExcluded          = isExcluded,
        isPayment           = isExcluded,
        lineType            = type?.name?.let { StatementLineDto.LineType.valueOf(it) },
        categoryAccountId   = categoryAccount?.id,
        categoryAccountName = categoryAccount?.name,
    )
}
