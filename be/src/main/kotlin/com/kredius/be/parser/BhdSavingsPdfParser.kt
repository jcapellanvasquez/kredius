package com.kredius.be.parser

import com.kredius.be.entity.CurrencyType
import org.springframework.stereotype.Component
import java.io.InputStream
import java.math.BigDecimal

/**
 * BHD savings/checking account statement ("Estado de cuenta"): each row has a reference,
 * a "Débitos"/"Créditos" pair and a running balance, instead of the card statement's
 * single amount + card last-4 (see [BhdPdfParser]).
 */
@Component
class BhdSavingsPdfParser {

    private val referenceRegex = Regex("""^\d+$""")

    // Non-transaction rows: table header, and the trailing
    // "N CKS" / "N DEBITOS" / "N CREDITOS" totals, plus surrounding boilerplate text.
    private val skipPatterns = listOf(
        "FECHA REF", " CKS", "DEBITOS", "CREDITOS",
        "ESTADO DE CUENTA", "CONFIRME LA VALIDEZ", "DOCUMENTO EMITIDO",
        "EL BANCO SIEMPRE", "ESCANEAME", "ESCANÉAME",
    )

    private val currencyHeaderRegex = Regex("""MONEDA""")

    fun parse(inputStream: InputStream): List<ParsedStatementRow> = parseText(BhdStatementText.loadText(inputStream))

    internal fun parseText(text: String): List<ParsedStatementRow> {
        val rawLines = BhdStatementText.lines(text)
        val result   = mutableListOf<ParsedStatementRow>()

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

            if (upper.contains("BALANCE INICIAL")) {
                // "Balance inicial: 01/08/2026 102,717.23"; the page header repeats the label without values
                val date    = BhdStatementText.dateRegex.find(line)
                val amounts = BhdStatementText.amountRegex.findAll(line).toList()
                if (date != null && amounts.isNotEmpty()) {
                    result += ParsedStatementRow(
                        date             = BhdStatementText.parseDate(date.value),
                        description      = "BALANCE INICIAL",
                        amount           = BhdStatementText.parseAmount(amounts.last().value),
                        currency         = currency,
                        direction        = RowDirection.CREDIT,
                        isInitialBalance = true,
                    )
                }
                continue
            }

            if (skipPatterns.any { upper.contains(it) }) continue

            result += tryParseRow(line, currency) ?: continue
        }

        return BhdStatementText.assignOccurrenceIndexes(result)
    }

    private fun tryParseRow(line: String, currency: CurrencyType): ParsedStatementRow? {
        val firstDate = BhdStatementText.leadingDate(line) ?: return null
        val rest      = line.removePrefix(firstDate.value).trim()

        val tokens = rest.split(Regex("\\s+")).toMutableList()
        if (tokens.isEmpty()) return null

        // Optional reference number immediately after the date
        val reference = if (referenceRegex.matches(tokens.first())) tokens.removeAt(0) else null

        // The last three amount-shaped tokens are Débitos, Créditos, Balance (in that order)
        val amountIndices = tokens.indices.filter { BhdStatementText.amountRegex.matches(tokens[it]) }
        if (amountIndices.size < 3) return null
        val (debitIdx, creditIdx) = amountIndices.takeLast(3)

        val description = tokens.subList(0, debitIdx).joinToString(" ").trim()
        if (description.isBlank()) return null

        val debit  = BhdStatementText.parseAmount(tokens[debitIdx])
        val credit = BhdStatementText.parseAmount(tokens[creditIdx])
        val isCredit = credit > BigDecimal.ZERO
        return ParsedStatementRow(
            date        = BhdStatementText.parseDate(firstDate.value),
            description = description,
            amount      = if (isCredit) credit else debit,
            currency    = currency,
            direction   = if (isCredit) RowDirection.CREDIT else RowDirection.DEBIT,
            reference   = reference,
        )
    }
}
