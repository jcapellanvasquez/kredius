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

interface TotalsView {
    val totalDebit: BigDecimal
    val totalCredit: BigDecimal
}

interface MonthlyFlowView {
    val monthStart: LocalDate
    val totalDebit: BigDecimal
    val totalCredit: BigDecimal
}

interface TransactionView {
    val id: Long
    val entryDate: LocalDate
    val description: String
    val amountRd: BigDecimal
    val side: String
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

    @Query(
        value = """
            SELECT COALESCE(SUM(CASE WHEN jl.side = 'DEBIT'  THEN jl.amount_rd ELSE 0 END), 0) AS totalDebit,
                   COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount_rd ELSE 0 END), 0) AS totalCredit
            FROM journal_lines jl
            JOIN journal_entries je ON jl.journal_entry_id = je.id
            WHERE je.user_id = :userId AND jl.account_id = :accountId
              AND je.entry_date < :before
        """,
        nativeQuery = true,
    )
    fun findBalanceBefore(
        @Param("userId") userId: Long,
        @Param("accountId") accountId: Long,
        @Param("before") before: LocalDate,
    ): TotalsView

    @Query(
        value = """
            SELECT DATE_TRUNC('month', je.entry_date)::date AS monthStart,
                   COALESCE(SUM(CASE WHEN jl.side = 'DEBIT'  THEN jl.amount_rd ELSE 0 END), 0) AS totalDebit,
                   COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount_rd ELSE 0 END), 0) AS totalCredit
            FROM journal_lines jl
            JOIN journal_entries je ON jl.journal_entry_id = je.id
            WHERE je.user_id = :userId AND jl.account_id = :accountId
              AND je.entry_date >= :from
            GROUP BY DATE_TRUNC('month', je.entry_date)
            ORDER BY monthStart
        """,
        nativeQuery = true,
    )
    fun findMonthlyFlow(
        @Param("userId") userId: Long,
        @Param("accountId") accountId: Long,
        @Param("from") from: LocalDate,
    ): List<MonthlyFlowView>

    @Query(
        value = """
            SELECT jl.id AS id, je.entry_date AS entryDate, je.description AS description,
                   jl.amount_rd AS amountRd, jl.side AS side
            FROM journal_lines jl
            JOIN journal_entries je ON jl.journal_entry_id = je.id
            WHERE je.user_id = :userId AND jl.account_id = :accountId
            ORDER BY je.entry_date DESC, je.id DESC, jl.id DESC
            LIMIT :pageSize OFFSET :pageOffset
        """,
        nativeQuery = true,
    )
    fun findTransactions(
        @Param("userId") userId: Long,
        @Param("accountId") accountId: Long,
        @Param("pageSize") pageSize: Int,
        @Param("pageOffset") pageOffset: Int,
    ): List<TransactionView>

    @Query(
        value = """
            SELECT COUNT(*) FROM journal_lines jl
            JOIN journal_entries je ON jl.journal_entry_id = je.id
            WHERE je.user_id = :userId AND jl.account_id = :accountId
        """,
        nativeQuery = true,
    )
    fun countTransactions(
        @Param("userId") userId: Long,
        @Param("accountId") accountId: Long,
    ): Long
}
