package com.kredius.be.service

import com.kredius.be.entity.Account
import com.kredius.be.entity.AccountType
import com.kredius.be.entity.CorrectionType
import com.kredius.be.entity.CurrencyType
import com.kredius.be.entity.EntrySide
import com.kredius.be.entity.ExchangeRate
import com.kredius.be.entity.JournalEntry
import com.kredius.be.entity.JournalLine
import com.kredius.be.entity.JournalSource
import com.kredius.be.entity.StatementImport
import com.kredius.be.entity.StatementLine
import com.kredius.be.entity.StatementLineType
import com.kredius.be.entity.User
import com.kredius.be.repository.JournalEntryRepository
import com.kredius.be.repository.JournalLineRepository
import org.springframework.stereotype.Service
import java.math.BigDecimal

@Service
class JournalService(
    private val journalEntryRepo: JournalEntryRepository,
    private val journalLineRepo: JournalLineRepository,
) {

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
        val sides = sidesFor(line.type!!, importStatement.account.type)
        val managedCategoryLine = journalLineRepo.save(
            JournalLine(
                journalEntry = savedEntry,
                account = line.categoryAccount!!,
                side = sides.category,
                currency = line.currency,
                originalAmount = line.amount,
                exchangeRate = if (line.currency == CurrencyType.USD) usdRate else null,
                amountRd = amountRd,
            )
        )
        val managedStatementLine = journalLineRepo.saveAndFlush(
            JournalLine(
                journalEntry = savedEntry,
                account = importStatement.account,
                side = sides.statementAccount,
                currency = line.currency,
                originalAmount = line.amount,
                exchangeRate = if (line.currency == CurrencyType.USD) usdRate else null,
                amountRd = amountRd,
            )
        )
        savedEntry.lines += listOf(managedCategoryLine, managedStatementLine)
        return managedCategoryLine
    }

    /**
     * Moves [posted]'s amount from its account (the old category) to [newCategory] with a new entry,
     * dated like the original so it lands in the same month. The original entry is never edited. The
     * new category takes the side the old one had, and the amounts, currency and rate are copied, so
     * the old category nets to zero.
     */
    fun postRecategorization(posted: JournalLine, oldCategory: Account, newCategory: Account, user: User): JournalEntry {
        val original = posted.journalEntry
        val entry = journalEntryRepo.save(
            JournalEntry(
                entryDate = original.entryDate,
                description = "Recategorización: ${oldCategory.name} → ${newCategory.name}",
                source = original.source,
                referenceId = original.referenceId,
                user = user,
                correctionType = CorrectionType.RECATEGORIZATION,
                amount = posted.amountRd,
            )
        )
        for ((account, side) in listOf(newCategory to posted.side, oldCategory to posted.side.opposite())) {
            entry.lines += journalLineRepo.save(
                JournalLine(
                    journalEntry = entry,
                    account = account,
                    side = side,
                    currency = posted.currency,
                    originalAmount = posted.originalAmount,
                    exchangeRate = posted.exchangeRate,
                    amountRd = posted.amountRd,
                )
            )
        }
        return entry
    }

    data class PostingSides(val statementAccount: EntrySide, val category: EntrySide)

    companion object {
        /**
         * When a statement row increases the statement account's balance, that account takes its
         * natural side; when it decreases it, the opposite side. The category takes the other side,
         * so the entry always balances.
         */
        fun sidesFor(direction: StatementLineType, statementAccountType: AccountType): PostingSides {
            val increases = when (direction) {
                StatementLineType.DEBIT -> statementAccountType == AccountType.LIABILITY
                StatementLineType.CREDIT -> statementAccountType == AccountType.ASSET
                StatementLineType.INITIAL_BALANCE ->
                    throw IllegalArgumentException("An initial balance row is never posted")
            }
            val natural = ACCOUNT_NATURE.getValue(statementAccountType)
            val statementSide = if (increases) natural else natural.opposite()
            return PostingSides(statementAccount = statementSide, category = statementSide.opposite())
        }

        private fun EntrySide.opposite() = if (this == EntrySide.DEBIT) EntrySide.CREDIT else EntrySide.DEBIT

        private val ACCOUNT_NATURE = mapOf(
            AccountType.ASSET to EntrySide.DEBIT,
            AccountType.LIABILITY to EntrySide.CREDIT,
            AccountType.EQUITY to EntrySide.CREDIT,
            AccountType.INCOME to EntrySide.CREDIT,
            AccountType.EXPENSE to EntrySide.DEBIT,
        )
    }
}
