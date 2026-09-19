package com.kredius.be.repository

import com.kredius.be.entity.PrincipalPayment
import org.springframework.data.jpa.repository.JpaRepository

interface PrincipalPaymentRepository : JpaRepository<PrincipalPayment, Long>
