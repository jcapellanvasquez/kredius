package com.kredius.be.repository

import com.kredius.be.entity.Budget
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface BudgetRepository : JpaRepository<Budget, Long> {
    fun findByAccountIdAndPeriod(accountId: Long, period: LocalDate): Budget?
    fun findByAccountIdInAndPeriod(accountIds: Collection<Long>, period: LocalDate): List<Budget>
}
