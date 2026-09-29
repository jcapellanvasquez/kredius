package com.kredius.be.parser

import com.kredius.be.entity.CurrencyType
import org.apache.pdfbox.Loader
import org.apache.pdfbox.text.PDFTextStripper
import java.io.InputStream
import java.math.BigDecimal
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/** Which way the money moved, as the bank prints it: a DEBIT is a charge or withdrawal, a CREDIT a payment or deposit. */
enum class RowDirection { DEBIT, CREDIT }

/** One row of a BHD statement, card or savings. */
data class ParsedStatementRow(
    val date: LocalDate,
    val description: String,
    val amount: BigDecimal,
    val currency: CurrencyType,
    val direction: RowDirection,
    val isInitialBalance: Boolean = false,
    /** Bank reference; savings statements only, and not unique (a fee shares it with its payment). */
    val reference: String? = null,
    /** 1-based position among identical rows (same date, description, amount and currency). */
    val occurrenceIndex: Int = 1,
)

/** What both BHD parsers share: PDF text extraction and the date/amount formats. */
internal object BhdStatementText {

    val dateRegex   = Regex("""\d{2}/\d{2}/\d{4}""")
    val amountRegex = Regex("""\d{1,3}(?:,\d{3})*\.\d{2}""")
    private val dateFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy")

    fun loadText(inputStream: InputStream): String =
        Loader.loadPDF(inputStream.readBytes()).use { doc ->
            PDFTextStripper().apply { setSortByPosition(true) }.getText(doc)
        }

    /** Trimmed, non-blank lines of the extracted text. */
    fun lines(text: String): List<String> = text.lines().map { it.trim() }.filter { it.isNotBlank() }

    /** The date a row starts with, or null when the line doesn't start with one. */
    fun leadingDate(line: String): MatchResult? = dateRegex.find(line)?.takeIf { it.range.first == 0 }

    fun parseDate(value: String): LocalDate = LocalDate.parse(value, dateFormatter)

    fun parseAmount(value: String): BigDecimal = BigDecimal(value.replace(",", ""))

    fun assignOccurrenceIndexes(rows: List<ParsedStatementRow>): List<ParsedStatementRow> {
        val seen = mutableMapOf<List<Any>, Int>()
        return rows.map { row ->
            val index = seen.merge(listOf(row.date, row.description, row.amount, row.currency), 1, Int::plus)!!
            row.copy(occurrenceIndex = index)
        }
    }
}
