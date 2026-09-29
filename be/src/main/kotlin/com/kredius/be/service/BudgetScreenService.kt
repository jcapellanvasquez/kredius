package com.kredius.be.service

import com.kredius.be.entity.Account
import com.kredius.be.entity.AccountType
import com.kredius.be.entity.RateContext
import com.kredius.be.entity.StatementImportStatus
import com.kredius.be.entity.StatementLine
import com.kredius.be.entity.StatementLineType
import com.kredius.be.entity.StatementType
import com.kredius.be.model.BudgetCardSummary
import com.kredius.be.model.BudgetCategoryRow
import com.kredius.be.model.BudgetLastUpload
import com.kredius.be.model.BudgetSavingsSummary
import com.kredius.be.model.BudgetScreenResponse
import com.kredius.be.model.BudgetStatementResult
import com.kredius.be.model.BudgetTransactionLine
import com.kredius.be.repository.BudgetRepository
import com.kredius.be.repository.AccountRepository
import com.kredius.be.repository.ExchangeRateRepository
import com.kredius.be.repository.JournalLineRepository
import com.kredius.be.repository.StatementImportRepository
import com.kredius.be.repository.StatementLineRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.LocalDate
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
) {
    fun get(period: LocalDate): BudgetScreenResponse {
        val userId = currentUser.id
        val from = period.withDayOfMonth(1)
        val next = from.plusMonths(1)
        val card = accountRepo.findFirstByUserIdAndStatementTypeAndActiveTrueOrderByCodeAsc(userId, StatementType.CREDIT_CARD)
        val savings = accountRepo.findFirstByUserIdAndStatementTypeAndActiveTrueOrderByCodeAsc(userId, StatementType.SAVINGS)
        val lines = lineRepo.findByStatementImportUserIdAndStatementImportStatusNotAndLineDateBetween(
            userId, StatementImportStatus.REVERSED, from, next.minusDays(1),
        )
        val usdRate by lazy { exchangeRateRepo.findTopByContextOrderByRateDateDesc(RateContext.CREDIT_CARD) }
        fun rd(line: StatementLine) = line.journalLine?.amountRd ?: amountRd(line, usdRate)

        val categories = categories(from, next, lines, ::rd)

        return BudgetScreenResponse(
            period = from,
            card = card?.let { account ->
                cardSummary(account, lines.filter { it.account.id == account.id }, ::rd, categories)
            },
            savings = savings?.let { savingsSummary(it, from, next) },
            lastUploads = listOfNotNull(card, savings).map { account ->
                BudgetLastUpload(
                    kind = ApiStatementType.valueOf(account.statementType!!.name),
                    accountId = account.id,
                    uploadedAt = importRepo.findTopByAccountIdOrderByCreatedAtDesc(account.id)?.createdAt,
                )
            },
            uncategorized = lines
                .filter { it.journalLine == null && !it.isExcluded }
                .sortedByDescending { it.lineDate }
                .map { it.toTransaction(rd(it)) },
            categories = categories,
        )
    }

    /**
     * Expense accounts with spend in the month or a budget saved for it. `actual` is debits − credits,
     * so recategorizations and reversals count. Sorted by actual / budget, highest first; categories
     * without a budget last.
     */
    private fun categories(
        from: LocalDate,
        next: LocalDate,
        lines: List<StatementLine>,
        rd: (StatementLine) -> BigDecimal,
    ): List<BudgetCategoryRow> {
        val userId = currentUser.id
        val expenses = accountRepo.findByUserIdAndType(userId, AccountType.EXPENSE)
        if (expenses.isEmpty()) return emptyList()
        val ids = expenses.map { it.id }
        val totals = journalLineRepo.findTotalsByPeriod(userId, from, next, ids).associateBy { it.accountId }
        val budgets = budgetRepo.findByAccountIdInAndPeriod(ids, from).associate { it.account.id to it.amount }
        val postedByCategory = lines
            .filter { it.journalLine != null && it.categoryAccount != null }
            .groupBy { it.categoryAccount!!.id }

        return expenses.mapNotNull { category ->
            val actual = totals[category.id]?.let { it.totalDebit - it.totalCredit } ?: BigDecimal.ZERO
            val budget = budgets[category.id]
            val own = postedByCategory[category.id].orEmpty()
            if (own.isEmpty() && actual.signum() == 0 && budget == null) return@mapNotNull null
            val transactions = own.sortedByDescending { it.lineDate }.map { it.toTransaction(rd(it)) }
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
            )
        }.sortedWith(
            compareByDescending<BudgetCategoryRow> { row -> row.budget?.takeIf { it > 0 }?.let { row.actual / it } ?: Double.NEGATIVE_INFINITY }
                .thenByDescending { it.actual }
                .thenBy { it.name },
        )
    }

    /** Positive = charge or money out, negative = payment, refund or money in. */
    private fun StatementLine.toTransaction(amountRd: BigDecimal) = BudgetTransactionLine(
        lineId = id,
        date = lineDate,
        description = description,
        amount = (if (type == StatementLineType.CREDIT) amountRd.negate() else amountRd).toDouble(),
        source = ApiStatementType.valueOf(statementImport.type.name),
        sourceIcon = account.icon,
        status = if (journalLine != null) BudgetTransactionLine.Status.POSTED else BudgetTransactionLine.Status.PENDING,
        categoryId = categoryAccount?.id,
        categoryName = categoryAccount?.name,
        suggestions = emptyList(),
    )

    private fun cardSummary(
        card: Account,
        cardLines: List<StatementLine>,
        rd: (StatementLine) -> BigDecimal,
        categories: List<BudgetCategoryRow>,
    ): BudgetCardSummary {
        val charges = cardLines.filter { it.type == StatementLineType.DEBIT }
        val payments = cardLines.filter { it.type == StatementLineType.CREDIT }
        val chargesRd = charges.sumOf(rd)
        val paymentsRd = payments.sumOf(rd)
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
            statement = if (cardLines.isEmpty()) null else BudgetStatementResult(
                charges = chargesRd.toDouble(),
                payments = paymentsRd.toDouble(),
                net = (chargesRd - paymentsRd).toDouble(),
            ),
        )
    }

    private fun savingsSummary(savings: Account, from: LocalDate, next: LocalDate): BudgetSavingsSummary {
        val userId = currentUser.id
        val totals = journalLineRepo.findBalanceBefore(userId, savings.id, next)
        return BudgetSavingsSummary(
            accountId = savings.id,
            name = savings.name,
            icon = savings.icon,
            balance = (totals.totalDebit - totals.totalCredit).toDouble(),
            income = journalLineRepo.findIncomeInto(userId, savings.id, from, next).toDouble(),
        )
    }
}
