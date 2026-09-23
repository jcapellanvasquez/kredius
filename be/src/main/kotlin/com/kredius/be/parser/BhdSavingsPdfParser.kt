package com.kredius.be.parser

import com.kredius.be.entity.CurrencyType
import org.apache.pdfbox.Loader
import org.apache.pdfbox.text.PDFTextStripper
import org.springframework.stereotype.Component
import java.io.InputStream
import java.math.BigDecimal
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * A parsed row from a BHD savings/checking account statement ("Estado de cuenta"),
 * as opposed to the credit-card statement handled by [BhdPdfParser].
 *
 * That statement type lists a single "Débitos"/"Créditos" pair per row plus a running
 * balance, instead of the single signed amount + card-last-4 layout used on credit-card
 * statements, so this is a separate parser rather than a reuse of [ParsedStatementLine].
 */
data class ParsedSavingsStatementLine(
    val transactionDate: LocalDate,
    val reference: String?,
    val description: String,
    val debit: BigDecimal,
    val credit: BigDecimal,
    val balance: BigDecimal,
    val currency: CurrencyType,
) {
    /** The non-zero movement amount for this row (credit if present, otherwise debit). */
    val amount: BigDecimal
        get() = if (credit > BigDecimal.ZERO) credit else debit

    /** True when this row reduced the balance (a debit/withdrawal), mirroring isPayment. */
    val isPayment: Boolean
        get() = debit > BigDecimal.ZERO
}

@Component
class BhdSavingsPdfParser {

    private val dateRegex     = Regex("""\d{2}/\d{2}/\d{4}""")
    private val amountRegex   = Regex("""\d{1,3}(?:,\d{3})*\.\d{2}""")
    private val referenceRegex = Regex("""^\d+$""")
    private val dateFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy")

    // Non-transaction rows: table header, opening-balance line, and the trailing
    // "N CKS" / "N DEBITOS" / "N CREDITOS" totals, plus surrounding boilerplate text.
    private val skipPatterns = listOf(
        "FECHA REF", "BALANCE INICIAL", " CKS", "DEBITOS", "CREDITOS",
        "ESTADO DE CUENTA", "CONFIRME LA VALIDEZ", "DOCUMENTO EMITIDO",
        "EL BANCO SIEMPRE", "ESCANEAME", "ESCANÉAME",
    )

    private val currencyHeaderRegex = Regex("""MONEDA""")

    fun parse(inputStream: InputStream): List<ParsedSavingsStatementLine> {
        val bytes = inputStream.readBytes()
        return Loader.loadPDF(bytes).use { doc ->
            val stripper = PDFTextStripper().apply { setSortByPosition(true) }
            val text = stripper.getText(doc)
            parseText(text)
        }
    }

    private fun parseText(text: String): List<ParsedSavingsStatementLine> {
        val rawLines = text.lines().map { it.trim() }.filter { it.isNotBlank() }
        val result   = mutableListOf<ParsedSavingsStatementLine>()

        var currency = CurrencyType.RD
        rawLines.forEachIndexed { i, line ->
            val upper = line.uppercase()
            if (currencyHeaderRegex.containsMatchIn(upper)) {
                // The account-details box has a standalone "Moneda" label followed by
                // the value ("RD$" / "USD$") on the next line.
                val value = rawLines.getOrNull(i + 1)?.uppercase().orEmpty()
                if ("USD" in value) currency = CurrencyType.USD
            }
        }

        for (line in rawLines) {
            val upper = line.uppercase()
            if (skipPatterns.any { upper.contains(it) }) continue

            val parsed = tryParseRow(line, currency) ?: continue
            result.add(parsed)
        }

        return result
    }

    private fun tryParseRow(line: String, currency: CurrencyType): ParsedSavingsStatementLine? {
        // Line must start with a transaction date: DD/MM/YYYY
        val firstDate = dateRegex.find(line) ?: return null
        if (firstDate.range.first != 0) return null

        val txDate = LocalDate.parse(firstDate.value, dateFormatter)
        val rest   = line.removePrefix(firstDate.value).trim()

        val tokens = rest.split(Regex("\\s+")).toMutableList()
        if (tokens.isEmpty()) return null

        // Optional reference number immediately after the date
        val reference = if (referenceRegex.matches(tokens.first())) tokens.removeAt(0) else null

        // The last three amount-shaped tokens are Débitos, Créditos, Balance (in that order)
        val amountIndices = tokens.indices.filter { amountRegex.matches(tokens[it]) }
        if (amountIndices.size < 3) return null
        val (debitIdx, creditIdx, balanceIdx) = amountIndices.takeLast(3)

        val debit   = BigDecimal(tokens[debitIdx].replace(",", ""))
        val credit  = BigDecimal(tokens[creditIdx].replace(",", ""))
        val balance = BigDecimal(tokens[balanceIdx].replace(",", ""))

        val description = tokens.subList(0, debitIdx).joinToString(" ").trim()
        if (description.isBlank()) return null

        return ParsedSavingsStatementLine(txDate, reference, description, debit, credit, balance, currency)
    }
}
