package com.kredius.be.repository

import com.kredius.be.entity.BudgetHistory
import org.springframework.data.jpa.repository.JpaRepository

interface BudgetHistoryRepository : JpaRepository<BudgetHistory, Long>
