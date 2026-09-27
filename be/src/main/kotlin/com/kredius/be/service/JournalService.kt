package com.kredius.be.service

import com.kredius.be.entity.CurrencyType
import com.kredius.be.entity.EntrySide
import com.kredius.be.entity.ExchangeRate
import com.kredius.be.entity.JournalEntry
import com.kredius.be.entity.JournalLine
import com.kredius.be.entity.JournalSource
import com.kredius.be.entity.StatementImport
import com.kredius.be.entity.StatementLine
import com.kredius.be.entity.User
import com.kredius.be.repository.JournalEntryRepository
import com.kredius.be.repository.JournalLineRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal

@Service
class JournalService(
    private val journalEntryRepo: JournalEntryRepository,
    private val journalLineRepo: JournalLineRepository,
) {
    @Transactional(propagation = Propagation.REQUIRES_NEW)

    fun saveJournalLine(
        line: StatementLine,
        importStatement: StatementImport,
        source: JournalSource,
        usdRate: ExchangeRate?,
        currentUser: User,
        amountRd: BigDecimal,
    ): JournalLine? {
        val savedEntry = journalEntryRepo.save(
            JournalEntry(
                entryDate = line.lineDate,
                description = line.description,
                source = source,
                referenceId = importStatement.id,
                user = currentUser,
                occurrenceIndex = line.occurrenceIndex,
                amount = amountRd,
            )
        )
        val managedDebitLine = journalLineRepo.save(
            JournalLine(
                journalEntry = savedEntry,
                account = line.categoryAccount!!,
                side = EntrySide.DEBIT,
                currency = line.currency,
                originalAmount = line.amount,
                exchangeRate = if (line.currency == CurrencyType.USD) usdRate else null,
                amountRd = amountRd,
            )
        )
        journalLineRepo.saveAndFlush(
            JournalLine(
                journalEntry = savedEntry,
                account = importStatement.account,
                side = EntrySide.CREDIT,
                currency = line.currency,
                originalAmount = line.amount,
                exchangeRate = if (line.currency == CurrencyType.USD) usdRate else null,
                amountRd = amountRd,
            )
        )
        return managedDebitLine
    }
}
