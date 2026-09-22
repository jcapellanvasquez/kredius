package com.kredius.be.repository

import com.kredius.be.entity.StatementLine
import org.springframework.data.jpa.repository.JpaRepository

interface StatementLineRepository : JpaRepository<StatementLine, Long> {
    fun findByIdAndStatementImportUserId(id: Long, userId: Long): StatementLine?
}
