package com.kredius.be.repository

import com.kredius.be.entity.ExchangeRate
import com.kredius.be.entity.RateContext
import org.springframework.data.jpa.repository.JpaRepository

interface ExchangeRateRepository : JpaRepository<ExchangeRate, Long> {
    fun findTopByContextOrderByRateDateDesc(context: RateContext): ExchangeRate?
}
