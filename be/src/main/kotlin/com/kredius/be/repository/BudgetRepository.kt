package com.kredius.be.repository

import com.kredius.be.entity.Budget
import org.springframework.data.jpa.repository.JpaRepository

interface BudgetRepository : JpaRepository<Budget, Long>
