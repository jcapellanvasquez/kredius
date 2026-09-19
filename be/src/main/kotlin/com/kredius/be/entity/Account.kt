package com.kredius.be.entity

import jakarta.persistence.*
import java.math.BigDecimal
import java.time.OffsetDateTime

@Entity
@Table(name = "accounts")
class Account(
    @Column(length = 10, unique = true)
    var code: String? = null,

    @Column(nullable = false, length = 120)
    var name: String = "",

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var type: AccountType = AccountType.ASSET,

    @Column(name = "threshold_pct", precision = 5, scale = 2)
    var thresholdPct: BigDecimal? = null,

    @Column(name = "show_in_alerts", nullable = false)
    var showInAlerts: Boolean = false,

    @Column(nullable = false)
    var active: Boolean = true,

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
) {
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
