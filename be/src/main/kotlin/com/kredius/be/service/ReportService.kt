package com.kredius.be.service

import com.kredius.be.entity.AccountType
import com.kredius.be.entity.Budget
import com.kredius.be.entity.BudgetHistory
import com.kredius.be.entity.BudgetOrigin
import com.kredius.be.exception.ApiException
import org.springframework.http.HttpStatus
import com.kredius.be.model.BatchBudgetUpdateRequest
import com.kredius.be.model.BudgetReportAccountRow
import com.kredius.be.model.BudgetReportResponse
import com.kredius.be.repository.AccountRepository
import com.kredius.be.repository.BudgetHistoryRepository
import com.kredius.be.repository.BudgetRepository
import com.kredius.be.repository.IncomeEntryRepository
import com.kredius.be.repository.JournalLineRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate

@Service
class ReportService(
    private val accountRepo: AccountRepository,
    private val incomeEntryRepo: IncomeEntryRepository,
    private val budgetRepo: BudgetRepository,
    private val budgetHistoryRepo: BudgetHistoryRepository,
    private val journalLineRepo: JournalLineRepository,
    private val currentUser: CurrentUserService,
) {

    @Transactional(readOnly = true)
    fun getBudgetReport(period: LocalDate): BudgetReportResponse {
        val userId      = currentUser.id
        val periodStart = period.withDayOfMonth(1)
        val periodEnd   = periodStart.withDayOfMonth(periodStart.lengthOfMonth())

        val lastPayroll = incomeEntryRepo.findPayrollsByUserId(userId, PageRequest.of(0, 1)).firstOrNull()

        val expenseAccounts = accountRepo.findByUserIdAndType(userId, AccountType.EXPENSE)
        val accountIds = expenseAccounts.map { it.id }

        val budgets = if (accountIds.isEmpty()) emptyMap()
            else budgetRepo.findByAccountIdInAndPeriod(accountIds, periodStart).associateBy { it.account.id }

        val actuals = if (accountIds.isEmpty()) emptyMap()
            else journalLineRepo.findActualsByPeriod(userId, periodStart, periodEnd, accountIds).associateBy { it.accountId }

        val totalIncome = journalLineRepo.findTotalIncomeCreditByPeriod(userId, periodStart, periodEnd)

        val rows = expenseAccounts.map { account ->
            val budget       = budgets[account.id]
            val actualAmount = actuals[account.id]?.actualAmount ?: BigDecimal.ZERO

            val budgetedAmount: BigDecimal?
            val budgetOrigin: BudgetReportAccountRow.BudgetOrigin?
            if (budget != null) {
                budgetedAmount = budget.amount
                budgetOrigin   = BudgetReportAccountRow.BudgetOrigin.MANUAL
            } else {
                val m3Start = periodStart.minusMonths(3)
                val m1Start = periodStart.minusMonths(1)
                val monthlyTotals = journalLineRepo.findThreeMonthActuals(userId, account.id, m3Start, m1Start)
                val suggestion = monthlyTotals.sumOf { it.total }
                    .divide(BigDecimal(3), 2, RoundingMode.HALF_UP)
                budgetedAmount = if (suggestion > BigDecimal.ZERO) suggestion else null
                budgetOrigin   = if (budgetedAmount != null) BudgetReportAccountRow.BudgetOrigin.AUTO_SUGGESTED else null
            }

            val lastPayrollAmount = lastPayroll?.netAmountRd
            val budgetedPct = budgetedAmount?.let { ba ->
                lastPayrollAmount?.takeIf { it > BigDecimal.ZERO }?.let { lp ->
                    ba.divide(lp, 4, RoundingMode.HALF_UP).multiply(BD_100).setScale(0, RoundingMode.HALF_UP).toInt()
                }
            }
            val actualPct = if (actualAmount > BigDecimal.ZERO) {
                lastPayrollAmount?.takeIf { it > BigDecimal.ZERO }?.let { lp ->
                    actualAmount.divide(lp, 4, RoundingMode.HALF_UP).multiply(BD_100).setScale(0, RoundingMode.HALF_UP).toInt()
                }
            } else null

            val isOverThreshold = account.showInAlerts && account.thresholdPct != null &&
                lastPayrollAmount != null && lastPayrollAmount > BigDecimal.ZERO &&
                actualAmount > lastPayrollAmount.multiply(account.thresholdPct!!.divide(BD_100))

            val displayName = if (account.code != null) "${account.code} ${account.name}" else account.name

            BudgetReportAccountRow(
                accountId      = account.id,
                name           = displayName,
                budgetedAmount = budgetedAmount?.toDouble(),
                budgetOrigin   = budgetOrigin,
                actualAmount   = actualAmount.toDouble(),
                budgetedPct    = budgetedPct,
                actualPct      = actualPct,
                showInAlerts   = account.showInAlerts,
                thresholdPct   = account.thresholdPct?.toDouble(),
                isOverThreshold = isOverThreshold,
            )
        }

        val totalExpenses = rows.sumOf { it.actualAmount ?: 0.0 }

        return BudgetReportResponse(
            period            = periodStart,
            income            = totalIncome.toDouble(),
            expenses          = totalExpenses,
            netProfit         = totalIncome.toDouble() - totalExpenses,
            lastPayrollAmount = lastPayroll?.netAmountRd?.toDouble(),
            lastPayrollDate   = lastPayroll?.entryDate,
            accounts          = rows,
        )
    }

    @Transactional
    fun batchUpdateBudgets(request: BatchBudgetUpdateRequest): BudgetReportResponse {
        val userId  = currentUser.id
        val user    = currentUser.user
        val period  = request.period.withDayOfMonth(1)

        for (update in request.updates) {
            if (update.amount < 0.0) throw ApiException("VALIDATION_ERROR", "Budget amount must be >= 0", HttpStatus.UNPROCESSABLE_ENTITY)

            val account = accountRepo.findByIdAndUserId(update.accountId, userId)
                ?: throw ApiException("NOT_FOUND", "Account ${update.accountId} not found", HttpStatus.NOT_FOUND)
            if (account.type != AccountType.EXPENSE)
                throw ApiException("VALIDATION_ERROR", "Account ${update.accountId} is not an expense account", HttpStatus.UNPROCESSABLE_ENTITY)

            val existing      = budgetRepo.findByAccountIdAndPeriod(account.id, period)
            val previousValue = existing?.amount
            val budget        = existing ?: Budget(account = account, period = period)
            budget.amount     = BigDecimal.valueOf(update.amount)
            budget.origin     = BudgetOrigin.MANUAL
            budgetRepo.save(budget)

            budgetHistoryRepo.save(BudgetHistory(
                account       = account,
                period        = period,
                previousValue = previousValue,
                newValue      = budget.amount,
                user          = user,
            ))
        }

        return getBudgetReport(period)
    }

    companion object {
        private val BD_100 = BigDecimal(100)
    }
}
