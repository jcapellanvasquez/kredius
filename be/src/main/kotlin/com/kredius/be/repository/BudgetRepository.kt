package com.kredius.be.repository

import com.kredius.be.entity.Budget
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface BudgetRepository : JpaRepository<Budget, Long> {
    fun findByAccountIdAndPeriod(accountId: Long, period: LocalDate): Budget?
    fun findByAccountIdInAndPeriod(accountIds: Collection<Long>, period: LocalDate): List<Budget>

    fun findTopByAccountIdAndPeriodLessThanOrderByPeriodDesc(accountId: Long, period: LocalDate): Budget?

    /** The latest budget saved for [period] or an earlier month: the card's budget carries forward until changed. */
    fun findTopByAccountIdAndPeriodLessThanEqualOrderByPeriodDesc(accountId: Long, period: LocalDate): Budget?
}
