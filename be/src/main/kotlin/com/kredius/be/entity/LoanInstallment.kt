package com.kredius.be.entity

import jakarta.persistence.*
import java.math.BigDecimal
import java.time.LocalDate

@Entity
@Table(name = "loan_installments")
class LoanInstallment(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "loan_id", nullable = false)
    var loan: Loan = Loan(),

    @Column(nullable = false)
    var number: Int = 0,

    @Column(name = "scheduled_date", nullable = false)
    var scheduledDate: LocalDate = LocalDate.now(),

    @Column(name = "scheduled_amount", nullable = false, precision = 14, scale = 2)
    var scheduledAmount: BigDecimal = BigDecimal.ZERO,

    @Column(name = "scheduled_interest", precision = 14, scale = 2)
    var scheduledInterest: BigDecimal? = null,

    @Column(name = "scheduled_principal", precision = 14, scale = 2)
    var scheduledPrincipal: BigDecimal? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    var status: InstallmentStatus = InstallmentStatus.PENDING,

    @Column(name = "actual_payment_date")
    var actualPaymentDate: LocalDate? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "journal_entry_id")
    var journalEntry: JournalEntry? = null,

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
)
