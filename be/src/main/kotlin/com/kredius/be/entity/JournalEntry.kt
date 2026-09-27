package com.kredius.be.entity

import jakarta.persistence.*
import org.hibernate.annotations.Filter
import java.math.BigDecimal
import java.time.LocalDate
import java.time.OffsetDateTime

@Filter(name = "userFilter", condition = "user_id = :userId")
@Entity
@Table(name = "journal_entries",
    uniqueConstraints = [
        UniqueConstraint(columnNames = [
            "description", "occurrence_index",
            "reference_id", "entry_date", "amount"])])
class JournalEntry(
    @Column(name = "entry_date", nullable = false)
    var entryDate: LocalDate = LocalDate.now(),

    @Column(nullable = false, length = 200)
    var description: String = "",

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    var source: JournalSource = JournalSource.MANUAL,

    @Column(name = "reference_id")
    var referenceId: Long? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    var user: User = User(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reverses_entry_id")
    var reversesEntry: JournalEntry? = null,

    @OneToMany(mappedBy = "journalEntry", cascade = [CascadeType.ALL], orphanRemoval = true)
    val lines: MutableList<JournalLine> = mutableListOf(),

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column("occurrence_index", nullable = false)
    val occurrenceIndex: Int = 0,

    @Column(nullable = false, precision = 14, scale = 2)
    var amount: BigDecimal = BigDecimal.ZERO,
) {
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
