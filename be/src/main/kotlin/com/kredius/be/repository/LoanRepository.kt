package com.kredius.be.repository

import com.kredius.be.entity.Loan
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface LoanRepository : JpaRepository<Loan, Long> {
    @Query("SELECT l.account.id FROM Loan l")
    fun findLoanAccountIds(): Set<Long>
}
