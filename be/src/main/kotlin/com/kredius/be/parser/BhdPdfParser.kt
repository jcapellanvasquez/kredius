package com.kredius.be.parser

import com.kredius.be.entity.CurrencyType
import org.springframework.stereotype.Component
import java.io.InputStream

/** BHD credit-card statement: transaction date, posting date, card last-4, description, amount. */
@Component
class BhdPdfParser {

    private val card4Regex = Regex("""^\d{4}$""")

    private val skipPatterns = listOf(
        "TRANSACCIONES EN", "TOTAL DE TRANSACCIONES",
        "INFORMACION DE", "ESTRELLAS", "TASA ", "SALDOS ",
        "INTERESES", "BAL.", "AHORRO MI PAIS",
    )
    private val paymentPatterns = listOf("PAGO DEBITO", "PAGO CREDITO")

    /** The card statement's summary (balance at the cut-off date) isn't read yet (found_bugs 1c). */
    fun parse(inputStream: InputStream): ParsedStatement = ParsedStatement(parseText(BhdStatementText.loadText(inputStream)))

    internal fun parseText(text: String): List<ParsedStatementRow> {
        val result = mutableListOf<ParsedStatementRow>()

        var currentCurrency      = CurrencyType.RD
        var inTransactionSection = false

        for (line in BhdStatementText.lines(text)) {
            val upper = line.uppercase()

            when {
                "TRANSACCIONES EN RD" in upper      -> { currentCurrency = CurrencyType.RD;  inTransactionSection = true;  continue }
                "TRANSACCIONES EN DOLARES" in upper -> { currentCurrency = CurrencyType.USD; inTransactionSection = true;  continue }
                "TOTAL DE TRANSACCIONES" in upper   -> { inTransactionSection = false; continue }
            }

            // Only process rows while inside a transaction section
            if (!inTransactionSection) continue
            if (skipPatterns.any { upper.contains(it) }) continue

            result += tryParseRow(line, currentCurrency) ?: continue
        }

        return BhdStatementText.assignOccurrenceIndexes(result)
    }

    private fun tryParseRow(line: String, currency: CurrencyType): ParsedStatementRow? {
        val firstDate = BhdStatementText.leadingDate(line) ?: return null
        var rest = line.removePrefix(firstDate.value).trim()

        // Skip optional posting date immediately following
        BhdStatementText.leadingDate(rest)?.let { rest = rest.removePrefix(it.value).trim() }

        // Strip the card-last-4 token that precedes the description on purchases (payments have none)
        val tokens = rest.split(Regex("\\s+"))
        val trimmed = if (tokens.firstOrNull()?.matches(card4Regex) == true) tokens.drop(1) else tokens

        // Amount is the last token matching amount pattern
        val amountIdx = trimmed.indexOfLast { BhdStatementText.amountRegex.matches(it) }
        if (amountIdx < 0) return null

        val description = trimmed.subList(0, amountIdx).joinToString(" ").trim()
        if (description.isBlank()) return null

        val isPayment = paymentPatterns.any { description.uppercase().contains(it) }
        return ParsedStatementRow(
            date        = BhdStatementText.parseDate(firstDate.value),
            description = description,
            amount      = BhdStatementText.parseAmount(trimmed[amountIdx]),
            currency    = currency,
            direction   = if (isPayment) RowDirection.CREDIT else RowDirection.DEBIT,
        )
    }
}
