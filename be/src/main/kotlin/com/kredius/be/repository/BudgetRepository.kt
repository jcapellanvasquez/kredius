package com.kredius.be.repository

import com.kredius.be.entity.Budget
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface BudgetRepository : JpaRepository<Budget, Long> {
    fun findByAccountIdAndPeriod(accountId: Long, period: LocalDate): Budget?
    fun findByAccountIdInAndPeriod(accountIds: Collection<Long>, period: LocalDate): List<Budget>

    /** Every budget saved for [period] or an earlier month; the latest per account is the one in force. */
    fun findByAccountIdInAndPeriodLessThanEqual(accountIds: Collection<Long>, period: LocalDate): List<Budget>

    /** The latest budget saved for [period] or an earlier month: a budget carries forward until changed. */
    fun findTopByAccountIdAndPeriodLessThanEqualOrderByPeriodDesc(accountId: Long, period: LocalDate): Budget?
}
