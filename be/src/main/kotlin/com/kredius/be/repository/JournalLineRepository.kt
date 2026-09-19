package com.kredius.be.repository

import com.kredius.be.entity.JournalLine
import org.springframework.data.jpa.repository.JpaRepository

interface JournalLineRepository : JpaRepository<JournalLine, Long>
