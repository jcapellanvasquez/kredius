package com.kredius.be.repository

import com.kredius.be.entity.StatementImport
import org.springframework.data.jpa.repository.JpaRepository

interface StatementImportRepository : JpaRepository<StatementImport, Long> {
    fun findByIdAndUserId(id: Long, userId: Long): StatementImport?

    fun findByUserIdOrderByStatementDateDesc(userId: Long): List<StatementImport>

    fun findTopByAccountIdOrderByCreatedAtDesc(accountId: Long): StatementImport?
}
