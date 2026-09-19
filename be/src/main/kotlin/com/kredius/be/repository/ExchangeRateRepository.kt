package com.kredius.be.repository

import com.kredius.be.entity.ExchangeRate
import org.springframework.data.jpa.repository.JpaRepository

interface ExchangeRateRepository : JpaRepository<ExchangeRate, Long>
