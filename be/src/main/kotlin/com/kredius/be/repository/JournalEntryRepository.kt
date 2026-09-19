package com.kredius.be.repository

import com.kredius.be.entity.JournalEntry
import org.springframework.data.jpa.repository.JpaRepository

interface JournalEntryRepository : JpaRepository<JournalEntry, Long>
