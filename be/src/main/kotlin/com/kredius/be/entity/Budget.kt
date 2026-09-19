package com.kredius.be.entity

import jakarta.persistence.*
import java.math.BigDecimal
import java.time.LocalDate
import java.time.OffsetDateTime

@Entity
@Table(name = "budgets", uniqueConstraints = [UniqueConstraint(columnNames = ["account_id", "period"])])
class Budget(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    var account: Account = Account(),

    @Column(nullable = false)
    var period: LocalDate = LocalDate.now(),

    @Column(nullable = false, precision = 14, scale = 2)
    var amount: BigDecimal = BigDecimal.ZERO,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var origin: BudgetOrigin = BudgetOrigin.AUTO_SUGGESTED,

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
) {
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
