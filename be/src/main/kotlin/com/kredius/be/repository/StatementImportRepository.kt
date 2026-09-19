package com.kredius.be.repository

import com.kredius.be.entity.StatementImport
import org.springframework.data.jpa.repository.JpaRepository

interface StatementImportRepository : JpaRepository<StatementImport, Long>
