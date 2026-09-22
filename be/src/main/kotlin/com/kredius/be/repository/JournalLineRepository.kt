package com.kredius.be.repository

import com.kredius.be.entity.JournalLine
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.math.BigDecimal
import java.time.LocalDate

interface AccountActualView {
    val accountId: Long
    val actualAmount: BigDecimal
}

interface MonthlyTotalView {
    val monthStart: LocalDate
    val total: BigDecimal
}

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

    @Query(
        value = """
            SELECT jl.account_id AS accountId, COALESCE(SUM(jl.amount_rd), 0) AS actualAmount
            FROM journal_lines jl
            JOIN journal_entries je ON je.id = jl.journal_entry_id
            WHERE je.user_id = :userId
              AND jl.side = 'DEBIT'
              AND je.entry_date >= :periodStart
              AND je.entry_date <= :periodEnd
              AND jl.account_id IN (:accountIds)
            GROUP BY jl.account_id
        """,
        nativeQuery = true,
    )
    fun findActualsByPeriod(
        @Param("userId") userId: Long,
        @Param("periodStart") periodStart: LocalDate,
        @Param("periodEnd") periodEnd: LocalDate,
        @Param("accountIds") accountIds: Collection<Long>,
    ): List<AccountActualView>

    @Query(
        value = """
            SELECT COALESCE(SUM(jl.amount_rd), 0)
            FROM journal_lines jl
            JOIN journal_entries je ON je.id = jl.journal_entry_id
            JOIN accounts a ON a.id = jl.account_id
            WHERE je.user_id = :userId
              AND jl.side = 'CREDIT'
              AND a.type = 'INCOME'
              AND je.entry_date >= :periodStart
              AND je.entry_date <= :periodEnd
        """,
        nativeQuery = true,
    )
    fun findTotalIncomeCreditByPeriod(
        @Param("userId") userId: Long,
        @Param("periodStart") periodStart: LocalDate,
        @Param("periodEnd") periodEnd: LocalDate,
    ): BigDecimal

    @Query(
        value = """
            SELECT m.month_start AS monthStart, COALESCE(a.total_sum, 0) AS total
            FROM (
                SELECT generate_series(:m3Start::date, :m1Start::date, interval '1 month')::date AS month_start
            ) m
            LEFT JOIN (
                SELECT DATE_TRUNC('month', je.entry_date)::date AS month_start,
                       SUM(jl.amount_rd) AS total_sum
                FROM journal_lines jl
                JOIN journal_entries je ON jl.journal_entry_id = je.id
                WHERE je.user_id = :userId
                  AND jl.account_id = :accountId
                  AND jl.side = 'DEBIT'
                GROUP BY DATE_TRUNC('month', je.entry_date)
            ) a ON a.month_start = m.month_start
        """,
        nativeQuery = true,
    )
    fun findThreeMonthActuals(
        @Param("userId") userId: Long,
        @Param("accountId") accountId: Long,
        @Param("m3Start") m3Start: LocalDate,
        @Param("m1Start") m1Start: LocalDate,
    ): List<MonthlyTotalView>
}
