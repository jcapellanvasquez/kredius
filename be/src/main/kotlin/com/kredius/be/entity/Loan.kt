package com.kredius.be.entity

import jakarta.persistence.*
import org.hibernate.annotations.Filter
import java.math.BigDecimal
import java.time.LocalDate
import java.time.OffsetDateTime

@Filter(name = "userFilter", condition = "user_id = :userId")
@Entity
@Table(name = "loans")
class Loan(
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false, unique = true)
    var account: Account = Account(),

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    var type: LoanType = LoanType.GIVEN,

    @Column(name = "counterparty_name", nullable = false, length = 120)
    var counterpartyName: String = "",

    @Column(nullable = false, precision = 14, scale = 2)
    var principal: BigDecimal = BigDecimal.ZERO,

    @Column(nullable = false, precision = 6, scale = 3)
    var rate: BigDecimal = BigDecimal.ZERO,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    var frequency: LoanFrequency = LoanFrequency.MONTHLY,

    @Column(name = "num_installments")
    var numInstallments: Int? = null,

    @Column(name = "installment_amount", nullable = false, precision = 14, scale = 2)
    var installmentAmount: BigDecimal = BigDecimal.ZERO,

    @Column(name = "start_date", nullable = false)
    var startDate: LocalDate = LocalDate.now(),

    @Column(nullable = false)
    var active: Boolean = true,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    var user: User = User(),

    @OneToMany(mappedBy = "loan", cascade = [CascadeType.ALL], orphanRemoval = true)
    val installments: MutableList<LoanInstallment> = mutableListOf(),

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
) {
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
