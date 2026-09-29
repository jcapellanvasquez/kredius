package com.kredius.be.service

import com.kredius.be.entity.CurrencyType
import com.kredius.be.entity.ExchangeRate
import com.kredius.be.entity.StatementLine
import java.math.BigDecimal

/** The line's amount in RD$; USD lines use [usdRate] (the latest credit-card rate). */
internal fun amountRd(line: StatementLine, usdRate: ExchangeRate?): BigDecimal =
    if (line.currency == CurrencyType.RD) line.amount
    else line.amount.multiply(usdRate?.value ?: BigDecimal.ONE)
