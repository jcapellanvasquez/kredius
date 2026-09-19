package com.kredius.be.repository

import com.kredius.be.entity.LoanInstallment
import org.springframework.data.jpa.repository.JpaRepository

interface LoanInstallmentRepository : JpaRepository<LoanInstallment, Long>
