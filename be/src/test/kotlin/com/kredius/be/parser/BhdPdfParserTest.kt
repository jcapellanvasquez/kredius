package com.kredius.be.parser

import com.kredius.be.entity.CurrencyType
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.LocalDate
import kotlin.test.assertEquals

/**
 * Baseline for the parser refactor: pins what the parser returns today for the sanitized
 * August 2026 card statement (text as PDFTextStripper extracts it, sorted by position).
 */
class BhdPdfParserTest {

    private val rows = BhdPdfParser().parseText(fixture("bhd-card-2026-08.txt"))

    private fun total(currency: CurrencyType, payments: Boolean) =
        rows.filter { it.currency == currency && it.isPayment == payments }.sumOf { it.amount }

    @Test
    fun `parses every transaction row of both currency sections`() {
        assertEquals(37, rows.count { it.currency == CurrencyType.RD })
        assertEquals(7, rows.count { it.currency == CurrencyType.USD })
    }

    @Test
    fun `charges match the statement totals`() {
        assertEquals(BigDecimal("76951.06"), total(CurrencyType.RD, payments = false))
        assertEquals(BigDecimal("198.93"), total(CurrencyType.USD, payments = false))
    }

    @Test
    fun `payments are flagged`() {
        // The statement's RD$ credit total (72,748.79) also includes AHORRO MI PAIS 110.85, which is skipped
        assertEquals(BigDecimal("72637.94"), total(CurrencyType.RD, payments = true))
        assertEquals(BigDecimal("567.44"), total(CurrencyType.USD, payments = true))
        assertEquals(3, rows.count { it.isPayment })
    }

    @Test
    fun `row fields`() {
        val payment = rows.first()
        assertEquals(LocalDate.of(2026, 7, 27), payment.transactionDate)
        assertEquals("PAGO DEBITO A CUENTA MBP", payment.description)
        assertEquals(BigDecimal("62637.94"), payment.amount)

        val charge = rows[1]
        assertEquals(LocalDate.of(2026, 7, 27), charge.transactionDate) // transaction date, not posting date
        assertEquals("1234 BRAVOVA #8787688 SANTODOMINGO-DO", charge.description) // card last-4 kept (fixed in B3)
        assertEquals(BigDecimal("5230.00"), charge.amount)
        assertEquals(false, charge.isPayment)
    }

    @Test
    fun `identical rows get increasing occurrence indexes`() {
        val text = """
            TRANSACCIONES EN RD$ PESOS
            01/08/2026 02/08/2026 1234 CAFE 100.00
            01/08/2026 02/08/2026 1234 CAFE 100.00
            01/08/2026 02/08/2026 1234 CAFE 250.00
            **TOTAL DE TRANSACCIONES EN RD$ PESOS**  450.00  0.00
        """.trimIndent()

        assertEquals(listOf(1, 2, 1), BhdPdfParser().parseText(text).map { it.occurrenceIndex })
        assertEquals(setOf(1), rows.map { it.occurrenceIndex }.toSet())
    }
}

internal fun fixture(name: String): String =
    requireNotNull(object {}.javaClass.getResource("/statements/$name")) { "Missing fixture $name" }.readText()
