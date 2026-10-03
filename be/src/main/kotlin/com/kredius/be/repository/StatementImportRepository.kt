package com.kredius.be.repository

import com.kredius.be.entity.StatementImport
import com.kredius.be.entity.StatementImportStatus
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface StatementImportRepository : JpaRepository<StatementImport, Long> {
    fun findByIdAndUserId(id: Long, userId: Long): StatementImport?

    fun findByUserIdAndStatusNot(userId: Long, status: StatementImportStatus): List<StatementImport>

    fun findByUserIdOrderByStatementDateDesc(userId: Long): List<StatementImport>

    fun findTopByAccountIdOrderByCreatedAtDesc(accountId: Long): StatementImport?

    fun existsByAccountIdAndStatusNotInAndCutOffDateGreaterThanEqual(
        accountId: Long,
        statuses: Collection<StatementImportStatus>,
        cutOffDate: LocalDate,
    ): Boolean

    fun findTopByAccountIdAndStatusNotAndCutOffDateLessThanOrderByCutOffDateDesc(
        accountId: Long,
        status: StatementImportStatus,
        cutOffDate: LocalDate,
    ): StatementImport?

    fun findTopByAccountIdAndStatusNotAndClosingBalanceNotNullAndCutOffDateLessThanEqualOrderByCutOffDateDesc(
        accountId: Long,
        status: StatementImportStatus,
        cutOffDate: LocalDate,
    ): StatementImport?
}
