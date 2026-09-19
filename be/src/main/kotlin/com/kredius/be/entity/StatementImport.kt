package com.kredius.be.entity

import jakarta.persistence.*
import org.hibernate.annotations.Filter
import java.time.LocalDate
import java.time.OffsetDateTime

@Filter(name = "userFilter", condition = "user_id = :userId")
@Entity
@Table(name = "statement_imports")
class StatementImport(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    var account: Account = Account(),

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var type: StatementType = StatementType.CREDIT_CARD,

    @Column(name = "statement_date", nullable = false)
    var statementDate: LocalDate = LocalDate.now(),

    @Column(name = "file_name", length = 200)
    var fileName: String? = null,

    @Column(nullable = false)
    var confirmed: Boolean = false,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    var user: User = User(),

    @OneToMany(mappedBy = "statementImport", cascade = [CascadeType.ALL], orphanRemoval = true)
    val lines: MutableList<StatementLine> = mutableListOf(),

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
) {
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
