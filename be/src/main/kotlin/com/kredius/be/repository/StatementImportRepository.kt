package com.kredius.be.repository

import com.kredius.be.entity.StatementImport
import com.kredius.be.entity.StatementImportStatus
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface StatementImportRepository : JpaRepository<StatementImport, Long> {
    fun findByAccountIdAndStatementDateAndStatus(
        accountId: Long,
        statementDate: LocalDate,
        status: StatementImportStatus
    ): StatementImport?

    fun findByIdAndUserId(id: Long, userId: Long): StatementImport?

    fun findByUserIdOrderByStatementDateDesc(userId: Long): List<StatementImport>
}
