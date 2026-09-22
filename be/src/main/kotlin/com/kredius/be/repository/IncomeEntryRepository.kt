package com.kredius.be.repository

import com.kredius.be.entity.IncomeEntry
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface IncomeEntryRepository : JpaRepository<IncomeEntry, Long> {

    @Query("""
        SELECT ie FROM IncomeEntry ie
        WHERE ie.destinationAccount.user.id = :userId AND ie.source = 'payroll'
        ORDER BY ie.entryDate DESC, ie.id DESC
    """)
    fun findPayrollsByUserId(@Param("userId") userId: Long, pageable: Pageable): List<IncomeEntry>
}
