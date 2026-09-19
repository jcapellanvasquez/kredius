package com.kredius.be.entity

import jakarta.persistence.*
import java.math.BigDecimal
import java.time.LocalDate
import java.time.OffsetDateTime

@Entity
@Table(name = "exchange_rates")
class ExchangeRate(
    @Column(name = "rate_date", nullable = false)
    var rateDate: LocalDate = LocalDate.now(),

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var context: RateContext = RateContext.OTHER,

    @Column(nullable = false, precision = 10, scale = 4)
    var value: BigDecimal = BigDecimal.ZERO,

    @Column(nullable = false, length = 20)
    var source: String = "auto",

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
) {
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
