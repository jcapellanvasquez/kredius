package com.kredius.be.entity

import jakarta.persistence.*
import java.time.LocalDate
import java.time.OffsetDateTime

@Entity
@Table(name = "journal_entries")
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

    @OneToMany(mappedBy = "journalEntry", cascade = [CascadeType.ALL], orphanRemoval = true)
    val lines: MutableList<JournalLine> = mutableListOf(),

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
) {
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
