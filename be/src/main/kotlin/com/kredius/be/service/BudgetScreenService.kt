package com.kredius.be.service

import com.kredius.be.entity.Account
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

        val categories = emptyList<BudgetCategoryRow>()

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
            uncategorized = emptyList(),
            categories = categories,
        )
    }

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
