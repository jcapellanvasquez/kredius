package com.kredius.be.entity

import jakarta.persistence.*
import java.math.BigDecimal
import java.time.OffsetDateTime

@Entity
@Table(name = "journal_lines")
class JournalLine(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "journal_entry_id", nullable = false)
    var journalEntry: JournalEntry = JournalEntry(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    var account: Account = Account(),

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    var side: EntrySide = EntrySide.DEBIT,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 5)
    var currency: CurrencyType = CurrencyType.RD,

    @Column(name = "original_amount", nullable = false, precision = 14, scale = 2)
    var originalAmount: BigDecimal = BigDecimal.ZERO,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exchange_rate_id")
    var exchangeRate: ExchangeRate? = null,

    @Column(name = "amount_rd", nullable = false, precision = 14, scale = 2)
    var amountRd: BigDecimal = BigDecimal.ZERO,

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
) {
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
