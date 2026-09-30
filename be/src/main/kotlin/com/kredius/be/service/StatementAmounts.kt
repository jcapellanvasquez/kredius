package com.kredius.be.service

import com.kredius.be.entity.CurrencyType
import com.kredius.be.entity.ExchangeRate
import com.kredius.be.entity.StatementLine
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * The line's amount in RD$, to the cent; USD lines use [usdRate] (the latest credit-card rate). US$ lines
 * are never posted without a rate; the fallback of 1 only affects the screen's RD$ figure for unposted ones.
 */
internal fun amountRd(line: StatementLine, usdRate: ExchangeRate?): BigDecimal =
    if (line.currency == CurrencyType.RD) line.amount
    else line.amount.multiply(usdRate?.value ?: BigDecimal.ONE).setScale(2, RoundingMode.HALF_UP)
