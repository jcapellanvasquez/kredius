package com.kredius.be.repository

import com.kredius.be.entity.StatementImportStatus
import com.kredius.be.entity.StatementLine
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface StatementLineRepository : JpaRepository<StatementLine, Long> {
    fun findByIdAndStatementImportUserId(id: Long, userId: Long): StatementLine?

    fun findByAccountIdAndLineDateBetween(accountId: Long, from: LocalDate, to: LocalDate): List<StatementLine>

    fun findByStatementImportUserIdAndStatementImportStatusNotAndLineDateBetween(
        userId: Long,
        status: StatementImportStatus,
        from: LocalDate,
        to: LocalDate,
    ): List<StatementLine>
}
