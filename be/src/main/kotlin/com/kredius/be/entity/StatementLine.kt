package com.kredius.be.entity

import jakarta.persistence.*
import java.math.BigDecimal
import java.time.LocalDate
import java.time.OffsetDateTime

@Entity
@Table(name = "statement_lines")
class StatementLine(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "statement_import_id", nullable = false)
    var statementImport: StatementImport = StatementImport(),

    @Column(name = "line_date", nullable = false)
    var lineDate: LocalDate = LocalDate.now(),

    @Column(nullable = false, length = 200)
    var description: String = "",

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 5)
    var currency: CurrencyType = CurrencyType.RD,

    @Column(nullable = false, precision = 14, scale = 2)
    var amount: BigDecimal = BigDecimal.ZERO,

    @Column(name = "is_excluded", nullable = false)
    var isExcluded: Boolean = false,

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
) {
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
