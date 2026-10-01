package com.kredius.be.entity

import jakarta.persistence.*
import java.math.BigDecimal
import java.time.LocalDate
import java.time.OffsetDateTime

@Entity
@Table(name = "statement_lines", uniqueConstraints = [
    UniqueConstraint(columnNames = [
        "account_id", "line_date", "description", "amount", "currency", "occurrence_index"])
])
class StatementLine(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "statement_import_id", nullable = false)
    var statementImport: StatementImport = StatementImport(),

    /** The statement's account, copied from the import so the dedup constraint can be per account. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false, updatable = false)
    val account: Account = Account(),

    @Column(name = "line_date", nullable = false)
    var lineDate: LocalDate = LocalDate.now(),

    /**
     * First day of the month whose budget the line counts in: a card line counts in its statement's
     * cut-off month (a statement cut on 26/09 also holds 27/08–31/08), any other line in its own month.
     */
    @Column(name = "budget_period", nullable = false)
    var budgetPeriod: LocalDate = lineDate.withDayOfMonth(1),

    @Column(nullable = false, length = 200)
    var description: String = "",

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 5)
    var currency: CurrencyType = CurrencyType.RD,

    @Column(nullable = false, precision = 14, scale = 2)
    var amount: BigDecimal = BigDecimal.ZERO,

    @Column(name = "is_excluded", nullable = false)
    var isExcluded: Boolean = false,

    @Enumerated(EnumType.STRING)
    @Column(name = "exclusion_reason", length = 40)
    var exclusionReason: ExclusionReason? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_account_id")
    var categoryAccount: Account? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "line_type", length = 20)
    var type: StatementLineType? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "journal_line_id")
    var journalLine: JournalLine? = null,

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column("occurrence_index", nullable = false)
    val occurrenceIndex: Int = 0,
) {
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()

    /** Excludes the line from posting; the only place that should set `isExcluded` to true. */
    fun exclude(reason: ExclusionReason) {
        isExcluded = true
        exclusionReason = reason
    }
}
