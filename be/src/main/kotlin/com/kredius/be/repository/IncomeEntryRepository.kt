package com.kredius.be.repository

import com.kredius.be.entity.IncomeEntry
import org.springframework.data.jpa.repository.JpaRepository

interface IncomeEntryRepository : JpaRepository<IncomeEntry, Long>
