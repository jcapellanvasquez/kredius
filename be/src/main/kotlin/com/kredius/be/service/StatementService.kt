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
import com.kredius.be.entity.AccountType as EntityAccountType
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
    private val loanRepo: LoanRepository,
    private val loanService: LoanService,
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

        val parsed = try {
            when (type) {
                ApiStatementType.SAVINGS -> savingsParser.parse(file.inputStream)
                else -> parser.parse(file.inputStream)
            }
        } catch (ex: Exception) {
            import.status = StatementImportStatus.FAILED
            import.errorMessage = ex.message?.take(500)
            return importRepo.save(import).toResponse()
        }
        val rows = parsed.rows
        import.cutOffDate = parsed.summary.cutOffDate
        import.closingBalance = parsed.summary.closingBalance
        import.closingBalanceUsd = parsed.summary.closingBalanceUsd
        import.minimumPayment = parsed.summary.minimumPayment
        import.minimumPaymentUsd = parsed.summary.minimumPaymentUsd
        import.paymentDueDate = parsed.summary.paymentDueDate

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
                budgetPeriod = import.budgetPeriodOf(row.date),
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

        // import.lines, not `lines`: saving the import merged the new lines, so the managed ones are in the import.
        import.lines.firstOrNull { it.type == StatementLineType.INITIAL_BALANCE }?.let { postOpeningBalance(import, it) }
        val autoPosted = postPending(import)
        return importRepo.save(import).toResponse(autoPostedCount = autoPosted)
    }

    /**
     * The first statement of an account sets its opening balance: its `BALANCE INICIAL` row posts once
     * against Capital Inicial (the first equity account) and links to that entry; the row stays excluded.
     * Later statements' initial balances are carried-over balances and post nothing.
     */
    private fun postOpeningBalance(import: StatementImport, row: StatementLine) {
        if (row.amount.signum() == 0) return
        if (journalEntryRepo.existsBySourceAndLinesAccountId(JournalSource.OPENING_BALANCE, import.account.id)) return
        val equity = accountRepo.findByUserIdAndType(currentUser.id, EntityAccountType.EQUITY)
            .minByOrNull { it.code ?: Int.MAX_VALUE } ?: return
        row.journalLine = journalService.postOpeningBalance(
            import.account, equity, row.amount, row.lineDate, import.id, currentUser.user,
        )
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
     * Rows stored but never posted. A card payment is posted from the savings statement, where the
     * dictionary maps `PAGO DE TC` to the card; posting both would count it twice. Other card credits
     * (e.g. the "AHORRO MI PAIS" cashback) post normally.
     */
    private fun ParsedStatementRow.exclusionReason(type: EntityStatementType) = when {
        isInitialBalance -> ExclusionReason.INITIAL_BALANCE
        type == EntityStatementType.CREDIT_CARD && isPayment ->
            ExclusionReason.CARD_PAYMENT_AVOID_DOUBLE_ENTRY
        else -> null
    }

    private fun ParsedStatementRow.lineType() = when {
        isInitialBalance -> StatementLineType.INITIAL_BALANCE
        direction == RowDirection.CREDIT -> StatementLineType.CREDIT
        else -> StatementLineType.DEBIT
    }

    /**
     * Sets a line's category or exclusion. An unposted line that ends up categorized and not excluded
     * is posted right away. A posted line can't be changed here: use recategorize.
     */
    fun patchLine(id: Long, request: PatchStatementLineRequest): StatementLineDto {
        val line = lineRepo.findByIdAndStatementImportUserId(id, currentUser.id)
            ?: throw ApiException(ApiException.NOT_FOUND, "Statement line not found", HttpStatus.NOT_FOUND)
        if (request.categoryAccountId == null && request.isExcluded == null) {
            throw ApiException(ApiException.BAD_REQUEST, "Nothing to update", HttpStatus.BAD_REQUEST)
        }
        requireNotReversed(line.statementImport)

        val category = request.categoryAccountId?.let { accId ->
            accountRepo.findByIdAndUserId(accId, currentUser.id)
                ?: throw ApiException(ApiException.NOT_FOUND, "Category account not found", HttpStatus.NOT_FOUND)
        }
        if (category != null && line.journalLine == null && line.currency == CurrencyType.USD &&
            exchangeRateRepo.findTopByContextOrderByRateDateDesc(RateContext.CREDIT_CARD) == null) {
            throw ApiException(ApiException.NO_EXCHANGE_RATE, "Falta la tasa del dólar para registrar líneas en US$",
                HttpStatus.UNPROCESSABLE_ENTITY)
        }
        if (line.journalLine != null) {
            if (category != null && category.id != line.categoryAccount?.id)
                throw ApiException(ApiException.CONFLICT, "Line is already posted; recategorize it instead", HttpStatus.CONFLICT)
            if (request.isExcluded == true)
                throw ApiException(ApiException.CONFLICT, "A posted line can't be excluded", HttpStatus.CONFLICT)
            return line.toDto()
        }

        when (request.isExcluded) {
            true -> line.exclude(ExclusionReason.USER_EXCLUDED)
            false -> {
                line.isExcluded = false
                line.exclusionReason = null
            }
            null -> {}
        }
        if (category != null) {
            line.categoryAccount = category
            learnMerchant(line.description, category)
        }
        postPending(line.statementImport, listOf(line))

        return lineRepo.save(line).toDto()
    }

    /**
     * Moves a posted line to another category by adding a correction entry (the original posting is
     * never edited), then updates the line and re-learns its merchant pattern.
     */
    fun recategorize(id: Long, request: RecategorizeStatementLineRequest) {
        val line = lineRepo.findByIdAndStatementImportUserId(id, currentUser.id)
            ?: throw ApiException(ApiException.NOT_FOUND, "Statement line not found", HttpStatus.NOT_FOUND)
        val posted = line.journalLine
            ?: throw ApiException(ApiException.CONFLICT, "Line isn't posted yet; set its category with PATCH", HttpStatus.CONFLICT)
        requireNotReversed(line.statementImport)
        val newCategory = accountRepo.findByIdAndUserId(request.categoryAccountId, currentUser.id)
            ?: throw ApiException(ApiException.NOT_FOUND, "Category account not found", HttpStatus.NOT_FOUND)
        val oldCategory = line.categoryAccount!!
        if (oldCategory.id in loanRepo.findLoanAccountIds(currentUser.id))
            throw ApiException(ApiException.CONFLICT, "A loan payment line can't be recategorized", HttpStatus.CONFLICT)
        if (newCategory.id == oldCategory.id)
            throw ApiException(ApiException.BAD_REQUEST, "The line already has this category", HttpStatus.BAD_REQUEST)

        journalService.postRecategorization(posted, oldCategory, newCategory, currentUser.user)
        line.categoryAccount = newCategory
        learnMerchant(line.description, newCategory)
        lineRepo.save(line)
    }

    /**
     * Saves the card's RD$ per US$ rate and posts the categorized US$ lines that were waiting for one,
     * in every import that isn't reversed. Returns the saved rate and how many lines were posted.
     */
    fun saveCardUsdRate(request: SaveExchangeRateRequest): SaveExchangeRateResponse {
        if (request.value <= 0.0)
            throw ApiException(ApiException.BAD_REQUEST, "The rate must be positive", HttpStatus.BAD_REQUEST)
        val rate = exchangeRateRepo.save(
            ExchangeRate(
                rateDate = request.rateDate ?: LocalDate.now(),
                context = RateContext.CREDIT_CARD,
                value = BigDecimal.valueOf(request.value).setScale(4, java.math.RoundingMode.HALF_UP),
                source = "manual",
            )
        )
        val posted = importRepo.findByUserIdAndStatusNot(currentUser.id, StatementImportStatus.REVERSED)
            .sumOf { import ->
                postPending(import, import.lines.filter { it.currency == CurrencyType.USD }).also { importRepo.save(import) }
            }
        return SaveExchangeRateResponse(value = rate.value.toDouble(), rateDate = rate.rateDate, postedLines = posted)
    }

    private fun requireNotReversed(import: StatementImport) {
        if (import.status == StatementImportStatus.REVERSED)
            throw ApiException(ApiException.CONFLICT, "Import is reversed", HttpStatus.CONFLICT)
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
        requireNotReversed(importStatement)

        val postedCount = postPending(importStatement)
        importRepo.saveAndFlush(importStatement)

        return ResponseEntity.ok(ConfirmImportResponse(
            id = importStatement.id,
            status = ApiStatus.valueOf(importStatement.status.name),
            postedEntries = postedCount,
        ))
    }

    /**
     * Posts the categorized lines among [candidates] that aren't posted yet, then sets the import to
     * CONFIRMED when no non-excluded line is left unposted, PENDING_REVIEW otherwise. Returns how many
     * lines were posted.
     */
    private fun postPending(import: StatementImport, candidates: List<StatementLine> = import.lines): Int {
        val usdRate = exchangeRateRepo.findTopByContextOrderByRateDateDesc(RateContext.CREDIT_CARD)
        // A US$ line waits for a card rate (POST /exchange-rates) instead of posting at an invented one.
        val pending = candidates.filter { isNewJournalEntry(it) && (it.currency != CurrencyType.USD || usdRate != null) }
        val loanAccountIds = if (pending.isEmpty()) emptySet() else loanRepo.findLoanAccountIds(currentUser.id)
        for (line in pending) {
            val amount = amountRd(line, usdRate)
            // A row matched to a loan account pays that loan's next installment (plan Q8); a row that
            // doesn't fit the loan path posts normally against the loan account.
            val loan = line.categoryAccount!!.id.takeIf { it in loanAccountIds }
                ?.let { loanRepo.findByAccountIdAndUserId(it, currentUser.id) }
            val loanPayment = loan?.let { loanService.payFromStatement(it, line, amount, import.journalSource(), import.id) }
            if (loanPayment?.alreadyRecorded == true) line.exclude(ExclusionReason.LOAN_PAYMENT_ALREADY_RECORDED)
            line.journalLine = loanPayment?.journalLine
                ?: journalService.saveJournalLine(
                    line = line, importStatement = import, source = import.journalSource(),
                    amountRd = amount, usdRate = usdRate, currentUser = currentUser.user)
        }
        val allPosted = import.lines.filter { !it.isExcluded }.all { it.journalLine != null }
        import.status = if (allPosted) StatementImportStatus.CONFIRMED else StatementImportStatus.PENDING_REVIEW
        return pending.count { !it.isExcluded } // a row linked to a hand payment posted nothing
    }

    /** A card statement's rows count in its cut-off month; savings rows (or no cut-off found) in their own. */
    private fun StatementImport.budgetPeriodOf(date: LocalDate): LocalDate =
        (cutOffDate?.takeIf { type == EntityStatementType.CREDIT_CARD } ?: date).withDayOfMonth(1)

    private fun StatementImport.journalSource() =
        if (type == EntityStatementType.CREDIT_CARD) JournalSource.CARD_STATEMENT else JournalSource.SAVINGS_STATEMENT

    fun reverse(id: Long): StatementImportResponse {
        val import = importRepo.findByIdAndUserId(id, currentUser.id)
            ?: throw ApiException(ApiException.NOT_FOUND, "Statement import not found", HttpStatus.NOT_FOUND)

        // PATCH posts line by line, so a PENDING_REVIEW import can already have entries to undo.
        if (import.status != StatementImportStatus.CONFIRMED && import.status != StatementImportStatus.PENDING_REVIEW)
            throw ApiException(ApiException.CONFLICT, "Import can't be reversed in ${import.status} status", HttpStatus.CONFLICT)

        // Every entry of the import shares its referenceId: original postings and recategorizations,
        // so the corrections are undone too and every account touched nets to zero.
        val source = import.journalSource()
        val originals = journalEntryRepo.findByReferenceIdAndSource(import.id, source)
            .filter { it.correctionType != CorrectionType.REVERSAL }
        for (original in originals) {
            // Dated like the entry it mirrors and in its budget period, so the month the original landed
            // in nets to zero instead of this month turning negative.
            val reversal = journalEntryRepo.save(
                JournalEntry(
                    entryDate = original.entryDate,
                    budgetPeriod = original.budgetPeriod,
                    description = "REVERSAL: ${original.description}",
                    source = source,
                    referenceId = import.id,
                    reversesEntry = original,
                    user = currentUser.user,
                    correctionType = CorrectionType.REVERSAL,
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
        loanService.reopenInstallmentsPaidBy(originals.map { it.id })

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
        uploadedAt = createdAt,
        fileName = fileName,
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
        fileName = fileName,
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
        posted = journalLine != null,
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
