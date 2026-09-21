package com.kredius.be.entity

import jakarta.persistence.*
import org.hibernate.annotations.Filter
import org.hibernate.annotations.FilterDef
import org.hibernate.annotations.ParamDef
import java.math.BigDecimal
import java.time.OffsetDateTime

@FilterDef(name = "userFilter", parameters = [ParamDef(name = "userId", type = Long::class)])
@Filter(name = "userFilter", condition = "user_id = :userId")
@Entity
@Table(name = "accounts")
class Account(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    var user: User = User(),

    @Column
    var code: Int? = null,

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
