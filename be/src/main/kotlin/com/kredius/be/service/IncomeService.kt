package com.kredius.be.service

import com.kredius.be.entity.*
import com.kredius.be.exception.ApiException
import com.kredius.be.model.CreateIncomeEntryRequest
import com.kredius.be.model.IncomeEntryResponse
import com.kredius.be.repository.*
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.math.RoundingMode

@Service
class IncomeService(
    private val incomeEntryRepo:  IncomeEntryRepository,
    private val accountRepo:      AccountRepository,
    private val journalEntryRepo: JournalEntryRepository,
    private val journalLineRepo:  JournalLineRepository,
    private val exchangeRateRepo: ExchangeRateRepository,
    private val currentUser:      CurrentUserService,
) {
    @Transactional(readOnly = true)
    fun listIncomeEntries(): List<IncomeEntryResponse> =
        incomeEntryRepo.findAllByUserId(currentUser.id).map { it.toResponse() }

    @Transactional
    fun createIncomeEntry(req: CreateIncomeEntryRequest): IncomeEntryResponse {
        val currency = if (req.currency == CreateIncomeEntryRequest.Currency.USD) CurrencyType.USD else CurrencyType.RD
        val amount   = BigDecimal.valueOf(req.amount)
        val bankFee  = req.bankFee?.let { BigDecimal.valueOf(it) } ?: BigDecimal.ZERO

        if (currency == CurrencyType.USD && req.rate == null) {
            throw ApiException("VALIDATION_ERROR", "Exchange rate is required for USD income", HttpStatus.UNPROCESSABLE_ENTITY)
        }

        val userId = currentUser.id
        val user   = currentUser.user

        val assetAccounts  = accountRepo.findByUserIdAndType(userId, AccountType.ASSET)
        val incomeAccounts = accountRepo.findByUserIdAndType(userId, AccountType.INCOME)

        val destinationAccount = assetAccounts.firstOrNull()
            ?: throw ApiException("NOT_FOUND", "No asset account found for user", HttpStatus.NOT_FOUND)
        val incomeAccount = incomeAccounts.firstOrNull()
            ?: throw ApiException("NOT_FOUND", "No income account found for user", HttpStatus.NOT_FOUND)

        val exchangeRate: ExchangeRate? = if (currency == CurrencyType.USD) {
            val rateContext = if (req.source == CreateIncomeEntryRequest.Source.PAYROLL) RateContext.PAYROLL else RateContext.OTHER
            exchangeRateRepo.save(ExchangeRate(
                rateDate = req.entryDate,
                context  = rateContext,
                value    = BigDecimal.valueOf(req.rate!!).setScale(4, RoundingMode.HALF_UP),
                source   = "manual",
            ))
        } else null

        val netAmountRd: BigDecimal = if (currency == CurrencyType.USD) {
            amount.multiply(BigDecimal.valueOf(req.rate!!)).subtract(bankFee).setScale(2, RoundingMode.HALF_UP)
        } else {
            amount.subtract(bankFee).setScale(2, RoundingMode.HALF_UP)
        }

        val sourceLabel = if (req.source == CreateIncomeEntryRequest.Source.PAYROLL) "Nomina" else "Otro ingreso"
        val description = "$sourceLabel — ${req.entryDate}"

        val journalEntry = journalEntryRepo.save(JournalEntry(
            entryDate   = req.entryDate,
            description = description,
            source      = JournalSource.INCOME,
            user        = user,
        ))

        journalLineRepo.saveAll(listOf(
            JournalLine(
                journalEntry   = journalEntry,
                account        = destinationAccount,
                side           = EntrySide.DEBIT,
                currency       = currency,
                originalAmount = amount,
                exchangeRate   = exchangeRate,
                amountRd       = netAmountRd,
            ),
            JournalLine(
                journalEntry   = journalEntry,
                account        = incomeAccount,
                side           = EntrySide.CREDIT,
                currency       = currency,
                originalAmount = amount,
                exchangeRate   = exchangeRate,
                amountRd       = netAmountRd,
            ),
        ))

        val entry = incomeEntryRepo.save(IncomeEntry(
            destinationAccount = destinationAccount,
            source             = req.source.value,
            currency           = currency,
            originalAmount     = amount,
            exchangeRate       = exchangeRate,
            bankFee            = bankFee,
            netAmountRd        = netAmountRd,
            entryDate          = req.entryDate,
            journalEntry       = journalEntry,
        ))

        return entry.toResponse()
    }

    private fun IncomeEntry.toResponse() = IncomeEntryResponse(
        id             = id,
        source         = source,
        currency       = currency.name,
        originalAmount = originalAmount.toDouble(),
        rate           = exchangeRate?.value?.toDouble(),
        bankFee        = bankFee.toDouble(),
        netAmountRd    = netAmountRd.toDouble(),
        entryDate      = entryDate,
    )
}
