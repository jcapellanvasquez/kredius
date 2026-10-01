package com.kredius.be.service

import com.kredius.be.entity.Account
import com.kredius.be.entity.AccountType
import com.kredius.be.entity.CurrencyType
import com.kredius.be.entity.ExclusionReason
import com.kredius.be.entity.InstallmentStatus
import com.kredius.be.entity.LoanInstallment
import com.kredius.be.entity.LoanType
import com.kredius.be.entity.RateContext
import com.kredius.be.entity.StatementImportStatus
import com.kredius.be.entity.StatementLine
import com.kredius.be.entity.StatementLineType
import com.kredius.be.entity.StatementType
import com.kredius.be.model.BudgetBankBalance
import com.kredius.be.model.BudgetCardCheck
import com.kredius.be.model.BudgetCardPayment
import com.kredius.be.model.BudgetCardSummary
import com.kredius.be.model.BudgetCategoryOption
import com.kredius.be.model.BudgetCategoryRow
import com.kredius.be.model.BudgetLastUpload
import com.kredius.be.model.BudgetSavingsSummary
import com.kredius.be.model.BudgetScreenResponse
import com.kredius.be.model.BudgetCardStatement
import com.kredius.be.model.BudgetStatementTotals
import com.kredius.be.model.BudgetTransactionLine
import com.kredius.be.model.BudgetLoanPayment
import com.kredius.be.repository.BudgetRepository
import com.kredius.be.repository.LoanInstallmentRepository
import com.kredius.be.repository.LoanRepository
import com.kredius.be.repository.AccountRepository
import com.kredius.be.repository.ExchangeRateRepository
import com.kredius.be.repository.JournalLineRepository
import com.kredius.be.repository.StatementImportRepository
import com.kredius.be.repository.StatementLineRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.LocalDate
import com.kredius.be.model.LoanType as ApiLoanType
import com.kredius.be.model.StatementType as ApiStatementType

/** Builds `GET /budget-screen` for one month. Lines of reversed imports are left out everywhere. */
@Service
@Transactional(readOnly = true)
class BudgetScreenService(
    private val currentUser: CurrentUserService,
    private val accountRepo: AccountRepository,
    private val importRepo: StatementImportRepository,
    private val lineRepo: StatementLineRepository,
    private val journalLineRepo: JournalLineRepository,
    private val exchangeRateRepo: ExchangeRateRepository,
    private val budgetRepo: BudgetRepository,
    private val loanRepo: LoanRepository,
    private val installmentRepo: LoanInstallmentRepository,
) {
    fun get(period: LocalDate): BudgetScreenResponse {
        val userId = currentUser.id
        val from = period.withDayOfMonth(1)
        val next = from.plusMonths(1)
        val card = accountRepo.findFirstByUserIdAndStatementTypeAndActiveTrueOrderByCodeAsc(userId, StatementType.CREDIT_CARD)
        val savings = accountRepo.findFirstByUserIdAndStatementTypeAndActiveTrueOrderByCodeAsc(userId, StatementType.SAVINGS)
        // The month's budget lines: savings rows dated in it, card rows of the statement cut in it.
        val lines = lineRepo.findByStatementImportUserIdAndStatementImportStatusNotAndBudgetPeriod(
            userId, StatementImportStatus.REVERSED, from,
        )
        val usdRate by lazy { exchangeRateRepo.findTopByContextOrderByRateDateDesc(RateContext.CREDIT_CARD) }
        fun rd(line: StatementLine) = line.journalLine?.amountRd ?: amountRd(line, usdRate)
        val expenses = accountRepo.findByUserIdAndType(userId, AccountType.EXPENSE)
        val incomes = accountRepo.findByUserIdAndType(userId, AccountType.INCOME)
        val uses = recentUses()
        val rankedExpenses = rankForSuggestions(expenses, uses)
        val rankedIncomes = rankForSuggestions(incomes, uses)
        // Money in (a savings credit, a card refund) is suggested income accounts; everything else expenses.
        fun transaction(line: StatementLine) = line.toTransaction(
            rd(line), if (line.type == StatementLineType.CREDIT) rankedIncomes else rankedExpenses,
        )

        val loanPayments = installmentRepo
            .findByLoanUserIdAndStatusAndActualPaymentDateBetween(userId, InstallmentStatus.PAID, from, next.minusDays(1))
            .filter { it.journalEntry != null }
            .sortedWith(compareBy({ it.actualPaymentDate }, { it.number }))
            .map { it to it.toLoanPayment(savings) }

        val categories = categories(from, expenses, lines, ::transaction, loanPayments)

        return BudgetScreenResponse(
            period = from,
            card = card?.let { account ->
                cardSummary(account, savings, lines.filter { it.account.id == account.id }, ::rd, categories, next.minusDays(1))
            },
            savings = savings?.let { account ->
                savingsSummary(account, from, next, loanPayments.map { (_, payment) -> payment },
                    cardPayments(account, card, lines, ::rd))
            },
            lastUploads = listOfNotNull(card, savings).map { account ->
                BudgetLastUpload(
                    kind = ApiStatementType.valueOf(account.statementType!!.name),
                    accountId = account.id,
                    uploadedAt = importRepo.findTopByAccountIdOrderByCreatedAtDesc(account.id)?.createdAt,
                )
            },
            // Every pending line, not just the month's: a statement's rows can fall in the previous month.
            uncategorized = lineRepo.findPendingByUserId(userId)
                .sortedByDescending { it.lineDate }
                .map(::transaction),
            categories = categories,
            loanOptions = loanRepo.findByUserId(userId)
                .filter { it.active }
                .map { BudgetCategoryOption(accountId = it.account.id, name = it.account.name, icon = it.account.icon) },
            incomeOptions = incomes
                .filter { it.active }
                .sortedBy { it.code ?: Int.MAX_VALUE }
                .map { BudgetCategoryOption(accountId = it.id, name = it.name, icon = it.icon) },
        )
    }

    /**
     * An installment's payment, read from its journal entry: the amount is the entry's line on savings
     * (the bank's amount for statement payments), the interest its expense (received loan) or income
     * (given loan) line.
     */
    private fun LoanInstallment.toLoanPayment(savings: Account?): BudgetLoanPayment {
        val entry = journalEntry!!
        val interestType = if (loan.type == LoanType.RECEIVED) AccountType.EXPENSE else AccountType.INCOME
        return BudgetLoanPayment(
            date = actualPaymentDate!!,
            loanAccountId = loan.account.id,
            loanName = loan.account.name,
            loanType = ApiLoanType.valueOf(loan.type.name),
            installmentNumber = number,
            totalInstallments = loan.numInstallments ?: loan.installments.size,
            amount = (entry.lines.firstOrNull { it.account.id == savings?.id }?.amountRd ?: entry.amount).toDouble(),
            interest = entry.lines.filter { it.account.type == interestType }.sumOf { it.amountRd }.toDouble(),
        )
    }

    /** The account a received-loan installment's interest was booked to, if any. */
    private fun LoanInstallment.interestAccountId(): Long? =
        if (loan.type != LoanType.RECEIVED) null
        else journalEntry!!.lines.firstOrNull { it.account.type == AccountType.EXPENSE }?.account?.id

    /**
     * Expense accounts with spend in the month or a budget saved for it. `actual` is debits − credits of
     * the entries in the month's budget period, so recategorizations and reversals count, and a card
     * statement counts whole in its cut-off month. Sorted by actual / budget, highest first; categories
     * without a budget last.
     */
    private fun categories(
        from: LocalDate,
        expenses: List<Account>,
        lines: List<StatementLine>,
        transaction: (StatementLine) -> BudgetTransactionLine,
        loanPayments: List<Pair<LoanInstallment, BudgetLoanPayment>>,
    ): List<BudgetCategoryRow> {
        val userId = currentUser.id
        if (expenses.isEmpty()) return emptyList()
        val ids = expenses.map { it.id }
        val totals = journalLineRepo.findTotalsByBudgetPeriod(userId, from, ids).associateBy { it.accountId }
        // Clearing a budget in the UI saves 0, which means "no budget" here.
        val budgets = budgetRepo.findByAccountIdInAndPeriod(ids, from)
            .filter { it.amount.signum() > 0 }
            .associate { it.account.id to it.amount }
        val postedByCategory = lines
            .filter { it.journalLine != null && it.categoryAccount != null }
            .groupBy { it.categoryAccount!!.id }

        return expenses.mapNotNull { category ->
            val actual = totals[category.id]?.let { it.totalDebit - it.totalCredit } ?: BigDecimal.ZERO
            val budget = budgets[category.id]
            val own = postedByCategory[category.id].orEmpty()
            if (own.isEmpty() && actual.signum() == 0 && budget == null) return@mapNotNull null
            val transactions = own.sortedByDescending { it.lineDate }.map(transaction)
            BudgetCategoryRow(
                accountId = category.id,
                name = category.name,
                icon = category.icon,
                actual = actual.toDouble(),
                budget = budget?.toDouble(),
                previousBudget = if (budget != null) null
                    else budgetRepo.findTopByAccountIdAndPeriodLessThanOrderByPeriodDesc(category.id, from)?.amount?.toDouble(),
                origins = transactions.map { it.source }.distinct().sortedBy { it.ordinal },
                transactions = transactions,
                loanInterest = loanPayments
                    .filter { (installment, _) -> installment.interestAccountId() == category.id }
                    .map { (_, payment) -> payment },
            )
        }.sortedWith(
            compareByDescending<BudgetCategoryRow> { row -> row.budget?.takeIf { it > 0 }?.let { row.actual / it } ?: Double.NEGATIVE_INFINITY }
                .thenByDescending { it.actual }
                .thenBy { it.name },
        )
    }

    /** Posted lines per category account in the last [SUGGESTION_WINDOW_DAYS] days. */
    private fun recentUses(): Map<Long, Int> {
        val today = LocalDate.now()
        return lineRepo.findByStatementImportUserIdAndStatementImportStatusNotAndLineDateBetween(
            currentUser.id, StatementImportStatus.REVERSED, today.minusDays(SUGGESTION_WINDOW_DAYS), today,
        )
            .filter { it.journalLine != null }
            .mapNotNull { it.categoryAccount?.id }
            .groupingBy { it }
            .eachCount()
    }

    /**
     * Active accounts, most posted lines in the last [SUGGESTION_WINDOW_DAYS] days first ([uses]), then by
     * account code; with no history this is plain code order.
     */
    private fun rankForSuggestions(accounts: List<Account>, uses: Map<Long, Int>): List<Account> {
        return accounts
            .filter { it.active }
            .sortedWith(compareByDescending<Account> { uses[it.id] ?: 0 }.thenBy { it.code ?: Int.MAX_VALUE })
    }

    /** Positive = charge or money out, negative = payment, refund or money in. */
    private fun StatementLine.toTransaction(amountRd: BigDecimal, ranked: List<Account>) = BudgetTransactionLine(
        lineId = id,
        date = lineDate,
        description = description,
        amount = (if (type == StatementLineType.CREDIT) amountRd.negate() else amountRd).toDouble(),
        currency = BudgetTransactionLine.Currency.valueOf(currency.name),
        originalAmount = (if (type == StatementLineType.CREDIT) amount.negate() else amount).toDouble(),
        source = ApiStatementType.valueOf(statementImport.type.name),
        sourceIcon = account.icon,
        status = if (journalLine != null) BudgetTransactionLine.Status.POSTED else BudgetTransactionLine.Status.PENDING,
        categoryId = categoryAccount?.id,
        categoryName = categoryAccount?.name,
        suggestions = ranked
            .filter { it.id != categoryAccount?.id }
            .take(SUGGESTED_CHIPS)
            .map { BudgetCategoryOption(accountId = it.id, name = it.name, icon = it.icon) },
    )

    private fun cardSummary(
        card: Account,
        savings: Account?,
        cardLines: List<StatementLine>,
        rd: (StatementLine) -> BigDecimal,
        categories: List<BudgetCategoryRow>,
        monthEnd: LocalDate,
    ): BudgetCardSummary {
        val charges = cardLines.filter { it.type == StatementLineType.DEBIT }
        val budget = categories
            .filter { ApiStatementType.CREDIT_CARD in it.origins }
            .mapNotNull { it.budget }
            .sum()
        return BudgetCardSummary(
            accountId = card.id,
            name = card.name,
            icon = card.icon,
            spent = charges.filter { it.journalLine != null }.sumOf(rd).toDouble(),
            budget = budget.takeIf { it > 0 },
            usdRate = exchangeRateRepo.findTopByContextOrderByRateDateDesc(RateContext.CREDIT_CARD)?.value?.toDouble(),
            statement = cardStatement(card, savings, monthEnd),
        )
    }

    /**
     * The latest card statement up to [monthEnd], as the bank reports it (found_bugs 1c): its billing cycle
     * runs from the day after the previous statement's cut-off date (or its own first row) to its cut-off
     * date. Charges and credits are summed per currency, never converted; the balance and minimum payment
     * come from the statement itself.
     */
    private fun cardStatement(card: Account, savings: Account?, monthEnd: LocalDate): BudgetCardStatement? {
        val statement = importRepo
            .findTopByAccountIdAndStatusNotAndClosingBalanceNotNullAndCutOffDateLessThanEqualOrderByCutOffDateDesc(
                card.id, StatementImportStatus.REVERSED, monthEnd,
            ) ?: return null
        val cutOff = statement.cutOffDate!!
        val cycleStart = importRepo
            .findTopByAccountIdAndStatusNotAndCutOffDateLessThanOrderByCutOffDateDesc(card.id, StatementImportStatus.REVERSED, cutOff)
            ?.cutOffDate?.plusDays(1)
            ?: statement.lines.minOfOrNull { it.lineDate }
            ?: cutOff
        val cycle = lineRepo.findByAccountIdAndLineDateBetween(card.id, cycleStart, cutOff)
            .filter { it.statementImport.status != StatementImportStatus.REVERSED && it.type != StatementLineType.INITIAL_BALANCE }
        fun totals(currency: CurrencyType, balance: BigDecimal?, minimum: BigDecimal?): BudgetStatementTotals? {
            val own = cycle.filter { it.currency == currency }
            if (own.isEmpty() && balance == null) return null
            val charges = own.filter { it.type == StatementLineType.DEBIT }.sumOf { it.amount }
            val credits = own.filter { it.type == StatementLineType.CREDIT }.sumOf { it.amount }
            return BudgetStatementTotals(
                charges = charges.toDouble(),
                credits = credits.toDouble(),
                previousBalance = balance?.let { it - charges + credits }?.toDouble(),
                balance = balance?.toDouble(),
                minimumPayment = minimum?.toDouble(),
            )
        }
        return BudgetCardStatement(
            cycleStart = cycleStart,
            cutOffDate = cutOff,
            paymentDueDate = statement.paymentDueDate,
            rd = totals(CurrencyType.RD, statement.closingBalance, statement.minimumPayment)
                ?: BudgetStatementTotals(charges = 0.0, credits = 0.0),
            usd = totals(CurrencyType.USD, statement.closingBalanceUsd, statement.minimumPaymentUsd),
            check = cardCheck(card, savings, statement.closingBalance!!, cutOff, cycle),
        )
    }

    /**
     * The card's RD$ balance at [cutOff], bank vs ledger, and what explains the gap: lines not posted yet,
     * and payments the ledger and the bank date differently. Savings pays the card with one RD$ row, posted
     * on the savings date; the bank applies it on the card's own payment row, maybe after the cut-off, and
     * may apply part of it to the US$ balance. Payments are counted from the card's first row: earlier ones
     * are in its opening balance. US$ isn't reconciled, only how many of the [cycle]'s charges are posted.
     */
    private fun cardCheck(
        card: Account,
        savings: Account?,
        bank: BigDecimal,
        cutOff: LocalDate,
        cycle: List<StatementLine>,
    ): BudgetCardCheck {
        val owed = journalLineRepo.findOriginalTotalsAt(currentUser.id, card.id, CurrencyType.RD.name, cutOff)
        val ledger = owed.totalCredit - owed.totalDebit
        val cardLines = lineRepo.findByAccountIdAndLineDateLessThanEqual(card.id, cutOff)
            .filter { it.statementImport.status != StatementImportStatus.REVERSED && it.type != StatementLineType.INITIAL_BALANCE }
        val pendingLines = cardLines.filter { it.currency == CurrencyType.RD && it.journalLine == null && !it.isExcluded }
        val pending = pendingLines.sumOf { if (it.type == StatementLineType.CREDIT) it.amount.negate() else it.amount }
        val firstRow = cardLines.minOfOrNull { it.lineDate } ?: cutOff
        val ledgerPayments = savings?.let {
            lineRepo.findByAccountIdAndCategoryAccountIdAndLineDateLessThanEqual(it.id, card.id, cutOff)
                .filter { line -> line.statementImport.status != StatementImportStatus.REVERSED }
                .filter { line -> line.journalLine != null && line.lineDate >= firstRow }
                .sumOf { line -> line.amount }
        } ?: BigDecimal.ZERO
        val bankPayments = cardLines
            .filter { it.exclusionReason == ExclusionReason.CARD_PAYMENT_AVOID_DOUBLE_ENTRY && it.currency == CurrencyType.RD }
            .sumOf { it.amount }
        val paymentsToReconcile = ledgerPayments - bankPayments
        val usdCharges = cycle.filter { it.currency == CurrencyType.USD && it.type == StatementLineType.DEBIT && !it.isExcluded }
        return BudgetCardCheck(
            ledger = ledger.toDouble(),
            pending = pending.toDouble(),
            pendingCount = pendingLines.size,
            paymentsToReconcile = paymentsToReconcile.toDouble(),
            difference = (bank - ledger - pending - paymentsToReconcile).toDouble(),
            usdCharges = usdCharges.size,
            usdPosted = usdCharges.count { it.journalLine != null },
        )
    }

    /**
     * The latest savings statement up to [monthEnd] that printed a final balance, next to the ledger
     * balance on its cut-off date. They match once every row up to that date is posted.
     */
    private fun bankBalance(savings: Account, monthEnd: LocalDate): BudgetBankBalance? {
        val statement = importRepo
            .findTopByAccountIdAndStatusNotAndClosingBalanceNotNullAndCutOffDateLessThanEqualOrderByCutOffDateDesc(
                savings.id, StatementImportStatus.REVERSED, monthEnd,
            ) ?: return null
        val date = statement.cutOffDate!!
        val totals = journalLineRepo.findBalanceBefore(currentUser.id, savings.id, date.plusDays(1))
        return BudgetBankBalance(
            date = date,
            bank = statement.closingBalance!!.toDouble(),
            ledger = (totals.totalDebit - totals.totalCredit).toDouble(),
        )
    }

    /**
     * The month's savings rows posted to the card (e.g. "PAGO DE TC"). They are transfers, so they appear
     * in no category; the savings card lists them.
     */
    private fun cardPayments(
        savings: Account,
        card: Account?,
        lines: List<StatementLine>,
        rd: (StatementLine) -> BigDecimal,
    ): List<BudgetCardPayment> {
        if (card == null) return emptyList()
        return lines
            .filter { it.account.id == savings.id && it.journalLine != null && it.categoryAccount?.id == card.id }
            .sortedBy { it.lineDate }
            .map { BudgetCardPayment(lineId = it.id, date = it.lineDate, amount = rd(it).toDouble()) }
    }

    private fun savingsSummary(
        savings: Account,
        from: LocalDate,
        next: LocalDate,
        loanPayments: List<BudgetLoanPayment>,
        cardPayments: List<BudgetCardPayment>,
    ): BudgetSavingsSummary {
        val userId = currentUser.id
        val totals = journalLineRepo.findBalanceBefore(userId, savings.id, next)
        return BudgetSavingsSummary(
            accountId = savings.id,
            name = savings.name,
            icon = savings.icon,
            balance = (totals.totalDebit - totals.totalCredit).toDouble(),
            income = journalLineRepo.findIncomeInto(userId, savings.id, from, next).toDouble(),
            loanPayments = loanPayments,
            cardPayments = cardPayments,
            bankBalance = bankBalance(savings, next.minusDays(1)),
        )
    }

    companion object {
        private const val SUGGESTED_CHIPS = 2
        private const val SUGGESTION_WINDOW_DAYS = 90L
    }
}
