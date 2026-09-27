package com.kredius.be.repository

import com.kredius.be.entity.StatementImport
import com.kredius.be.entity.StatementImportStatus
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.time.LocalDate

interface StatementImportRepository : JpaRepository<StatementImport, Long> {
    fun findByAccountIdAndStatementDateAndStatus(
        accountId: Long,
        statementDate: LocalDate,
        status: StatementImportStatus
    ): StatementImport?

    @Query(value = "SELECT e FROM StatementImport e " +
            "WHERE e.account.id = :accountId and MONTH(e.statementDate) = :statementDate")
    fun findByAccountIdAndStatementDateMonth(accountId: Long, statementDate: Int): StatementImport?

    fun findByIdAndUserId(id: Long, userId: Long): StatementImport?

    fun findByUserIdOrderByStatementDateDesc(userId: Long): List<StatementImport>
}
