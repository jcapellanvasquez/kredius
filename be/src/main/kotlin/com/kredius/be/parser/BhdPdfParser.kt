package com.kredius.be.parser

import com.kredius.be.entity.CurrencyType
import org.apache.pdfbox.Loader
import org.apache.pdfbox.text.PDFTextStripper
import org.springframework.stereotype.Component
import java.io.InputStream
import java.math.BigDecimal
import java.time.LocalDate
import java.time.format.DateTimeFormatter

data class ParsedStatementLine(
    val transactionDate: LocalDate,
    val description: String,
    val amount: BigDecimal,
    val currency: CurrencyType,
    val isPayment: Boolean,
)

@Component
class BhdPdfParser {

    private val dateRegex       = Regex("""\d{2}/\d{2}/\d{4}""")
    private val amountRegex     = Regex("""\d{1,3}(?:,\d{3})*\.\d{2}""")
    private val card4Regex      = Regex("""^\d{4}$""")
    private val dateFormatter   = DateTimeFormatter.ofPattern("dd/MM/yyyy")

    private val skipPatterns = listOf(
        "TRANSACCIONES EN", "TOTAL DE TRANSACCIONES",
        "INFORMACION DE", "ESTRELLAS", "TASA ", "SALDOS ",
        "INTERESES", "BAL.", "AHORRO MI PAIS",
    )
    private val autoExcludePatterns = listOf("PAGO DEBITO", "PAGO CREDITO")

    fun parse(inputStream: InputStream): List<ParsedStatementLine> {
        val bytes = inputStream.readBytes()
        return Loader.loadPDF(bytes).use { doc ->
            val stripper = PDFTextStripper().apply { setSortByPosition(true) }
            val text = stripper.getText(doc)
            parseText(text)
        }
    }

    private fun parseText(text: String): List<ParsedStatementLine> {
        val rawLines = text.lines().map { it.trim() }.filter { it.isNotBlank() }
        val result   = mutableListOf<ParsedStatementLine>()

        var currentCurrency = CurrencyType.RD

        for (line in rawLines) {
            val upper = line.uppercase()

            // Currency section markers
            when {
                "TRANSACCIONES EN RD" in upper      -> { currentCurrency = CurrencyType.RD;  continue }
                "TRANSACCIONES EN DOLARES" in upper -> { currentCurrency = CurrencyType.USD; continue }
            }
            if (skipPatterns.any { upper.contains(it) }) continue

            val parsed = tryParseRow(line, currentCurrency) ?: continue
            result.add(parsed)
        }

        return result
    }

    private fun tryParseRow(line: String, currency: CurrencyType): ParsedStatementLine? {
        // Line must start with a transaction date: DD/MM/YYYY
        val firstDate = dateRegex.find(line) ?: return null
        if (firstDate.range.first != 0) return null

        val txDate = LocalDate.parse(firstDate.value, dateFormatter)
        var rest   = line.removePrefix(firstDate.value).trim()

        // Skip optional posting date immediately following
        val secondDate = dateRegex.find(rest)
        if (secondDate != null && secondDate.range.first == 0) {
            rest = rest.removePrefix(secondDate.value).trim()
        }

        // Strip trailing card-last-4 token (e.g. "7971")
        val tokens = rest.split(Regex("\\s+"))
        val trimmed = if (tokens.lastOrNull()?.matches(card4Regex) == true) tokens.dropLast(1) else tokens

        // Amount is the last token matching amount pattern
        val amountIdx = trimmed.indexOfLast { amountRegex.matches(it) }
        if (amountIdx < 0) return null

        val amount      = BigDecimal(trimmed[amountIdx].replace(",", ""))
        val description = trimmed.subList(0, amountIdx).joinToString(" ").trim()
        if (description.isBlank()) return null

        val upper     = description.uppercase()
        val isPayment = autoExcludePatterns.any { upper.contains(it) }

        return ParsedStatementLine(txDate, description, amount, currency, isPayment)
    }
}
