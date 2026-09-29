package com.kredius.be.repository

import com.kredius.be.entity.InstallmentStatus
import com.kredius.be.entity.LoanInstallment
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDate

interface LoanInstallmentRepository : JpaRepository<LoanInstallment, Long> {

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM LoanInstallment li WHERE li.loan.id = :loanId AND li.status = 'PENDING'")
    fun deletePendingByLoanId(@Param("loanId") loanId: Long)

    fun findByJournalEntryIdIn(entryIds: Collection<Long>): List<LoanInstallment>

    fun findByLoanUserIdAndStatusAndActualPaymentDateBetween(
        userId: Long,
        status: InstallmentStatus,
        from: LocalDate,
        to: LocalDate,
    ): List<LoanInstallment>
}
