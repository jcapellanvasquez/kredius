package com.kredius.be.repository

import com.kredius.be.entity.JournalEntry
import com.kredius.be.entity.JournalSource
import org.springframework.data.jpa.repository.JpaRepository

interface JournalEntryRepository : JpaRepository<JournalEntry, Long> {
    fun findByReferenceIdAndSource(referenceId: Long, source: JournalSource): List<JournalEntry>
}
