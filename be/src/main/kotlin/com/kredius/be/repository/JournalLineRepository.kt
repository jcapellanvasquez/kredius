package com.kredius.be.repository

import com.kredius.be.entity.JournalLine
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.math.BigDecimal
import java.time.LocalDate

interface AccountBalanceView {
    val accountId: Long
    val totalDebit: BigDecimal
    val totalCredit: BigDecimal
}

interface AccountLastTransactionView {
    val accountId: Long
    val lastDate: LocalDate
    val lastDescription: String
    val lastAmount: BigDecimal
    val lastSide: String
}

interface JournalLineRepository : JpaRepository<JournalLine, Long> {

    @Query(
        value = """
            SELECT jl.account_id AS accountId,
                   COALESCE(SUM(CASE WHEN jl.side = 'DEBIT'  THEN jl.amount_rd ELSE 0 END), 0) AS totalDebit,
                   COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount_rd ELSE 0 END), 0) AS totalCredit
            FROM journal_lines jl
            JOIN journal_entries je ON jl.journal_entry_id = je.id
            WHERE je.user_id = :userId
            GROUP BY jl.account_id
        """,
        nativeQuery = true,
    )
    fun findAccountBalances(@Param("userId") userId: Long): List<AccountBalanceView>

    @Query(
        value = """
            SELECT DISTINCT ON (jl.account_id)
                jl.account_id AS accountId,
                je.entry_date AS lastDate,
                je.description AS lastDescription,
                jl.amount_rd AS lastAmount,
                jl.side AS lastSide
            FROM journal_lines jl
            JOIN journal_entries je ON jl.journal_entry_id = je.id
            WHERE je.user_id = :userId
            ORDER BY jl.account_id, je.entry_date DESC, je.id DESC, jl.id DESC
        """,
        nativeQuery = true,
    )
    fun findLastTransactions(@Param("userId") userId: Long): List<AccountLastTransactionView>
}
