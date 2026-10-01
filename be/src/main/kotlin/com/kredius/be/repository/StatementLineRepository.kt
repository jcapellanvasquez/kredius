package com.kredius.be.repository

import com.kredius.be.entity.StatementImportStatus
import com.kredius.be.entity.StatementLine
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDate

interface StatementLineRepository : JpaRepository<StatementLine, Long> {
    fun findByIdAndStatementImportUserId(id: Long, userId: Long): StatementLine?

    fun existsByJournalLineJournalEntryId(journalEntryId: Long): Boolean

    fun findByAccountIdAndLineDateBetween(accountId: Long, from: LocalDate, to: LocalDate): List<StatementLine>

    fun findByAccountIdAndLineDateLessThanEqual(accountId: Long, date: LocalDate): List<StatementLine>

    fun findByAccountIdAndCategoryAccountIdAndLineDateLessThanEqual(
        accountId: Long,
        categoryAccountId: Long,
        date: LocalDate,
    ): List<StatementLine>

    fun findByStatementImportUserIdAndStatementImportStatusNotAndLineDateBetween(
        userId: Long,
        status: StatementImportStatus,
        from: LocalDate,
        to: LocalDate,
    ): List<StatementLine>

    fun findByStatementImportUserIdAndStatementImportStatusNotAndBudgetPeriod(
        userId: Long,
        status: StatementImportStatus,
        budgetPeriod: LocalDate,
    ): List<StatementLine>

    /** Unposted, non-excluded lines of the user's imports that aren't reversed, whatever their date. */
    @Query("""
        SELECT l FROM StatementLine l
        WHERE l.statementImport.user.id = :userId
          AND l.statementImport.status <> com.kredius.be.entity.StatementImportStatus.REVERSED
          AND l.journalLine IS NULL AND l.isExcluded = false
    """)
    fun findPendingByUserId(@Param("userId") userId: Long): List<StatementLine>
}
