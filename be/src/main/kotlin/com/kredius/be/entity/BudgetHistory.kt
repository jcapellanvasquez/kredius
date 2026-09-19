package com.kredius.be.entity

import jakarta.persistence.*
import org.hibernate.annotations.Filter
import java.math.BigDecimal
import java.time.LocalDate
import java.time.OffsetDateTime

@Filter(name = "userFilter", condition = "user_id = :userId")
@Entity
@Table(name = "budget_history")
class BudgetHistory(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    var account: Account = Account(),

    @Column(nullable = false)
    var period: LocalDate = LocalDate.now(),

    @Column(name = "previous_value", precision = 14, scale = 2)
    var previousValue: BigDecimal? = null,

    @Column(name = "new_value", nullable = false, precision = 14, scale = 2)
    var newValue: BigDecimal = BigDecimal.ZERO,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    var user: User = User(),

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
) {
    @Column(name = "changed_at", nullable = false, updatable = false)
    val changedAt: OffsetDateTime = OffsetDateTime.now()
}
