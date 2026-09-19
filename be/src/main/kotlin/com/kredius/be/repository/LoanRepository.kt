package com.kredius.be.repository

import com.kredius.be.entity.Loan
import org.springframework.data.jpa.repository.JpaRepository

interface LoanRepository : JpaRepository<Loan, Long>
