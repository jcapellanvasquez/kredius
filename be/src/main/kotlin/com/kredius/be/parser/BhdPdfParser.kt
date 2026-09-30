package com.kredius.be.parser

import com.kredius.be.entity.CurrencyType
import org.springframework.stereotype.Component
import java.io.InputStream

/** BHD credit-card statement: transaction date, posting date, card last-4, description, amount. */
@Component
class BhdPdfParser {

    private val card4Regex = Regex("""^\d{4}$""")
    private val headerDatesRegex = Regex("""(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})$""")
    private val summaryRowRegex = Regex("""^\d+((?:\s+\d{1,3}(?:,\d{3})*\.\d{2}){7})$""")

    private val skipPatterns = listOf(
        "TRANSACCIONES EN", "TOTAL DE TRANSACCIONES",
        "INFORMACION DE", "ESTRELLAS", "TASA ", "SALDOS ",
        "INTERESES", "BAL.",
    )
    private val paymentPatterns = listOf("PAGO DEBITO", "PAGO CREDITO")
    /** Credits to the card that aren't payments, e.g. the "AHORRO MI PAIS" cashback. */
    private val otherCreditPatterns = listOf("AHORRO MI PAIS")

    fun parse(inputStream: InputStream): ParsedStatement {
        val text = BhdStatementText.loadText(inputStream)
        return ParsedStatement(parseText(text), parseSummary(text))
    }

    /**
     * The header's cut-off and due dates (the address line ends with both, e.g. "… 26/08/2026 21/09/2026"),
     * and the per-currency summary rows under the transactions, RD$ first then US$:
     * `0  0.00  1,858.16  0.00  1,858.16  66,840.21  0.00  66,840.21`. The 2nd amount is the minimum
     * payment and the last the balance at the cut-off date. The rows repeat on every page; the first two count.
     */
    internal fun parseSummary(text: String): StatementSummary {
        val lines = BhdStatementText.lines(text)
        val dates = lines.firstNotNullOfOrNull { line ->
            headerDatesRegex.find(line)?.takeIf { BhdStatementText.leadingDate(line) == null }
        }
        val balances = lines.mapNotNull { summaryRowRegex.matchEntire(it) }
            .map { match -> match.groupValues[1].trim().split(Regex("\\s+")).map(BhdStatementText::parseAmount) }
            .take(2)
        return StatementSummary(
            cutOffDate = dates?.groupValues?.get(1)?.let(BhdStatementText::parseDate),
            paymentDueDate = dates?.groupValues?.get(2)?.let(BhdStatementText::parseDate),
            closingBalance = balances.getOrNull(0)?.last(),
            minimumPayment = balances.getOrNull(0)?.get(1),
            closingBalanceUsd = balances.getOrNull(1)?.last(),
            minimumPaymentUsd = balances.getOrNull(1)?.get(1),
        )
    }

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

        val upper = description.uppercase()
        val isPayment = paymentPatterns.any { upper.contains(it) }
        val isCredit = isPayment || otherCreditPatterns.any { upper.contains(it) }
        return ParsedStatementRow(
            date        = BhdStatementText.parseDate(firstDate.value),
            description = description,
            amount      = BhdStatementText.parseAmount(trimmed[amountIdx]),
            currency    = currency,
            direction   = if (isCredit) RowDirection.CREDIT else RowDirection.DEBIT,
            isPayment   = isPayment,
        )
    }
}
