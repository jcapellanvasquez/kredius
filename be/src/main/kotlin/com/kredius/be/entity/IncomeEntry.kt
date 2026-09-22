package com.kredius.be.entity

import jakarta.persistence.*
import java.math.BigDecimal
import java.time.LocalDate
import java.time.OffsetDateTime

@Entity
@Table(name = "income_entries")
class IncomeEntry(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destination_account_id", nullable = false)
    var destinationAccount: Account = Account(),

    @Column(nullable = false, length = 50)
    var source: String = "payroll",

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 5)
    var currency: CurrencyType = CurrencyType.RD,

    @Column(name = "original_amount", nullable = false, precision = 14, scale = 2)
    var originalAmount: BigDecimal = BigDecimal.ZERO,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exchange_rate_id")
    var exchangeRate: ExchangeRate? = null,

    @Column(name = "bank_fee", nullable = false, precision = 14, scale = 2)
    var bankFee: BigDecimal = BigDecimal.ZERO,

    @Column(name = "net_amount_rd", nullable = false, precision = 14, scale = 2)
    var netAmountRd: BigDecimal = BigDecimal.ZERO,

    @Column(name = "entry_date", nullable = false)
    var entryDate: LocalDate = LocalDate.now(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "journal_entry_id")
    var journalEntry: JournalEntry? = null,

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
) {
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
