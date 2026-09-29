package com.kredius.be.parser

import com.kredius.be.entity.CurrencyType
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.LocalDate
import kotlin.test.assertEquals

/**
 * Baseline for the parser refactor: pins what the parser returns today for the sanitized
 * August 2026 savings statement (text as PDFTextStripper extracts it, sorted by position).
 */
class BhdSavingsPdfParserTest {

    private val rows = BhdSavingsPdfParser().parseText(fixture("bhd-savings-2026-08.txt"))
    private val movements = rows.filter { !it.isInitialBalance }

    @Test
    fun `parses the initial balance and every movement across pages`() {
        assertEquals(1, rows.count { it.isInitialBalance })
        assertEquals(32, movements.size)
        assertEquals(setOf(CurrencyType.RD), rows.map { it.currency }.toSet())
    }

    @Test
    fun `debits and credits match the statement totals`() {
        val (credits, debits) = movements.partition { it.direction == RowDirection.CREDIT }
        assertEquals(30, debits.size)
        assertEquals(BigDecimal("204812.67"), debits.sumOf { it.amount })
        assertEquals(2, credits.size)
        assertEquals(BigDecimal("198451.64"), credits.sumOf { it.amount })
    }

    @Test
    fun `initial balance`() {
        val initial = rows.first()
        assertEquals(true, initial.isInitialBalance)
        assertEquals("BALANCE INICIAL", initial.description)
        assertEquals(BigDecimal("102717.23"), initial.amount)
        assertEquals(null, initial.reference)
        // Its date is LocalDate.now() today, not the printed 01/08/2026 (fixed in B3), so it isn't pinned
    }

    @Test
    fun `row fields`() {
        val first = movements.first()
        assertEquals(LocalDate.of(2026, 8, 3), first.date)
        assertEquals("105664", first.reference)
        assertEquals("Ret. VISA ABPHNM", first.description)
        assertEquals(BigDecimal("4900.00"), first.amount)
        assertEquals(RowDirection.DEBIT, first.direction)

        val income = movements.first { it.direction == RowDirection.CREDIT }
        assertEquals("CR TR INTL: ACME CORP LLC USD TRA", income.description)
        assertEquals(BigDecimal("198450.00"), income.amount)
    }

    @Test
    fun `rows sharing a reference stay separate`() {
        val shared = movements.filter { it.reference == "1297695" }
        assertEquals(listOf("Imp. transferencia o cheque", "PAGO DE TC 4000 0000 0000 1234"), shared.map { it.description })
    }

    @Test
    fun `identical rows get increasing occurrence indexes`() {
        val text = """
            Fecha Ref. Detalles Débitos Créditos Balance
            01/08/2026 111 CAFE 100.00 0.00 900.00
            01/08/2026 112 CAFE 100.00 0.00 800.00
            01/08/2026 113 CAFE 250.00 0.00 550.00
        """.trimIndent()

        assertEquals(listOf(1, 2, 1), BhdSavingsPdfParser().parseText(text).map { it.occurrenceIndex })
    }

    @Test
    fun `the statement's two identical withdrawals are told apart`() {
        // Same date, description and amount; only the bank reference differs
        val withdrawals = movements.filter {
            it.date == LocalDate.of(2026, 8, 10) && it.description == "Ret. VISA APAP- SUCURSAL"
        }
        assertEquals(listOf("2766046", "2790152"), withdrawals.map { it.reference })
        assertEquals(listOf(1, 2), withdrawals.map { it.occurrenceIndex })
        assertEquals(1, movements.count { it.occurrenceIndex == 2 })
    }
}
