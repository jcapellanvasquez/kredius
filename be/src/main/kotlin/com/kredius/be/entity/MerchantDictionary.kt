package com.kredius.be.entity

import jakarta.persistence.*
import java.time.OffsetDateTime

@Entity
@Table(name = "merchant_dictionary")
class MerchantDictionary(
    @Column(name = "text_pattern", nullable = false, length = 150, unique = true)
    var textPattern: String = "",

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    var account: Account = Account(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    var user: User = User(),

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
) {
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()

    @Column(name = "updated_at", nullable = false)
    var updatedAt: OffsetDateTime = OffsetDateTime.now()
}
