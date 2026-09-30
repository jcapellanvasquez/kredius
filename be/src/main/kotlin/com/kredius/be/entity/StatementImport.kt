package com.kredius.be.entity

import jakarta.persistence.*
import org.hibernate.annotations.Filter
import java.math.BigDecimal
import java.time.LocalDate
import java.time.OffsetDateTime

@Filter(name = "userFilter", condition = "user_id = :userId")
@Entity
@Table(name = "statement_imports")
class StatementImport(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    var account: Account = Account(),

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var type: StatementType = StatementType.CREDIT_CARD,

    @Column(name = "statement_date", nullable = false)
    var statementDate: LocalDate = LocalDate.now(),

    @Column(name = "file_name", length = 200)
    var fileName: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: StatementImportStatus = StatementImportStatus.UPLOADED,

    @Column(name = "error_message", length = 500)
    var errorMessage: String? = null,

    /** "Fecha de corte" printed on the statement, when it prints one. */
    @Column(name = "cut_off_date")
    var cutOffDate: LocalDate? = null,

    /** The balance the bank reports at [cutOffDate] ("Balance final"). */
    @Column(name = "closing_balance", precision = 14, scale = 2)
    var closingBalance: BigDecimal? = null,

    /** Card statements: the US$ balance at [cutOffDate]. */
    @Column(name = "closing_balance_usd", precision = 14, scale = 2)
    var closingBalanceUsd: BigDecimal? = null,

    /** Card statements: the minimum payment, RD$ and US$, and its due date. */
    @Column(name = "minimum_payment", precision = 14, scale = 2)
    var minimumPayment: BigDecimal? = null,

    @Column(name = "minimum_payment_usd", precision = 14, scale = 2)
    var minimumPaymentUsd: BigDecimal? = null,

    @Column(name = "payment_due_date")
    var paymentDueDate: LocalDate? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    var user: User = User(),

    @OneToMany(mappedBy = "statementImport", cascade = [CascadeType.ALL], orphanRemoval = true)
    val lines: MutableList<StatementLine> = mutableListOf(),

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
) {
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
