package com.kredius.be.service

import com.kredius.be.entity.Account
import com.kredius.be.entity.AccountType
import com.kredius.be.entity.InstallmentStatus
import com.kredius.be.exception.ApiException
import com.kredius.be.model.AccountDetailResponse
import com.kredius.be.model.AccountResponse
import com.kredius.be.model.AccountSummaryResponse
import com.kredius.be.model.CreateAccountRequest
import com.kredius.be.model.LoanData
import com.kredius.be.model.MonthlyBalancePoint
import com.kredius.be.model.TransactionItem
import com.kredius.be.model.TransactionPageResponse
import com.kredius.be.repository.AccountRepository
import com.kredius.be.repository.JournalLineRepository
import com.kredius.be.repository.LoanRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale
import com.kredius.be.entity.LoanFrequency
import com.kredius.be.model.AccountType as ApiAccountType
import com.kredius.be.model.LoanFrequency as ApiLoanFrequency
import com.kredius.be.model.LoanType as ApiLoanType

@Service
@Transactional(readOnly = true)
class AccountService(
    private val accountRepo: AccountRepository,
    private val loanRepo: LoanRepository,
    private val journalLineRepo: JournalLineRepository,
    private val currentUser: CurrentUserService,
) {
    fun getAll(type: ApiAccountType?): List<AccountResponse> {
        val userId         = currentUser.id
        val loanAccountIds = loanRepo.findLoanAccountIds(userId)
        return accountRepo.findByUserId(userId)
            .filter { it.active }
            .let { if (type != null) it.filter { a -> a.type == AccountType.valueOf(type.value) } else it }
            .map { it.toResponse(loanAccount = it.id in loanAccountIds) }
    }

    fun getSummary(): List<AccountSummaryResponse> {
        val userId           = currentUser.id
        val loansByAccountId = loanRepo.findByUserId(userId).filter { it.active }.associateBy { it.account.id }
        val balances         = journalLineRepo.findAccountBalances(userId).associateBy { it.accountId }
        val lastTransactions = journalLineRepo.findLastTransactions(userId).associateBy { it.accountId }

        return accountRepo.findByUserId(userId)
            .filter { it.active }
            .map { account ->
                val bal    = balances[account.id]
                val debit  = bal?.totalDebit  ?: BigDecimal.ZERO
                val credit = bal?.totalCredit ?: BigDecimal.ZERO
                val balance = when (account.type) {
                    AccountType.ASSET, AccountType.EXPENSE -> debit - credit
                    else                                   -> credit - debit
                }
                val last = lastTransactions[account.id]
                val loan = loansByAccountId[account.id]
                val pending  = loan?.installments?.filter { it.status == InstallmentStatus.PENDING } ?: emptyList()
                val nextDate = pending.minByOrNull { it.scheduledDate }?.scheduledDate
                val remaining = pending.fold(BigDecimal.ZERO) { acc, i -> acc + i.scheduledAmount }
                val total     = loan?.installments?.fold(BigDecimal.ZERO) { acc, i -> acc + i.scheduledAmount }

                AccountSummaryResponse(
                    id                         = account.id,
                    code                       = account.code,
                    name                       = account.name,
                    type                       = ApiAccountType.valueOf(account.type.name),
                    showInAlerts               = account.showInAlerts,
                    thresholdPct               = account.thresholdPct?.toDouble(),
                    loanAccount                = loan != null,
                    balance                    = balance.toDouble(),
                    lastTransactionDate        = last?.lastDate,
                    lastTransactionDescription = last?.lastDescription,
                    lastTransactionValue       = last?.let { signedTxValue(account.type, it.lastSide, it.lastAmount) },
                    loanId                     = loan?.id,
                    loanType                   = loan?.type?.let { ApiLoanType.valueOf(it.name) },
                    loanCounterpartyName       = loan?.counterpartyName,
                    loanInstallmentAmount      = loan?.installmentAmount?.toDouble(),
                    loanNextInstallmentDate    = nextDate,
                    loanRemainingBalance       = remaining.toDouble().takeIf { loan != null },
                    loanTotalAmount            = total?.toDouble(),
                )
            }
    }

    fun getDetail(id: Long): AccountDetailResponse {
        val userId  = currentUser.id
        val account = accountRepo.findByIdAndUserId(id, userId)
            ?: throw ApiException("NOT_FOUND", "Account not found", org.springframework.http.HttpStatus.NOT_FOUND)

        // Current balance
        val balances = journalLineRepo.findAccountBalances(userId).associateBy { it.accountId }
        val bal      = balances[id]
        val balance  = netBalance(account.type, bal?.totalDebit ?: BigDecimal.ZERO, bal?.totalCredit ?: BigDecimal.ZERO)

        // 6-month trend: base balance + cumulative monthly flow
        val today       = LocalDate.now()
        val windowStart = today.withDayOfMonth(1).minusMonths(5)
        val base        = journalLineRepo.findBalanceBefore(userId, id, windowStart)
        val baseNet     = (base.totalDebit) - (base.totalCredit)  // net debit before window
        val flowByMonth = journalLineRepo.findMonthlyFlow(userId, id, windowStart)
            .associateBy { it.monthStart }

        var runningNet = baseNet
        val trend = (0L..5L).map { offset ->
            val monthStart = windowStart.plusMonths(offset)
            val flow       = flowByMonth[monthStart]
            runningNet    += (flow?.totalDebit ?: BigDecimal.ZERO) - (flow?.totalCredit ?: BigDecimal.ZERO)
            MonthlyBalancePoint(
                month   = monthStart.month.getDisplayName(TextStyle.SHORT, Locale("es")).lowercase().removeSuffix("."),
                balance = netBalance(account.type, runningNet, BigDecimal.ZERO).toDouble(),
            )
        }

        // First page of transactions
        val txViews = journalLineRepo.findTransactions(userId, id, pageSize = 5, pageOffset = 0)
        val txTotal = journalLineRepo.countTransactions(userId, id)

        // Loan info
        val loan = loanRepo.findByAccountIdAndUserId(id, userId)
        val loanData = loan?.let {
            val paidCount = it.installments.count { inst -> inst.status == InstallmentStatus.PAID }
            val remainingBalance = it.installments
                .filter { inst -> inst.status == InstallmentStatus.PENDING }
                .sumOf { inst -> inst.scheduledPrincipal ?: BigDecimal.ZERO }
            LoanData(
                type              = ApiLoanType.valueOf(it.type.name),
                counterpartyName  = it.counterpartyName,
                principal         = it.principal.toDouble(),
                rate              = it.rate.toDouble(),
                frequency         = ApiLoanFrequency.valueOf(it.frequency.name),
                numInstallments   = it.numInstallments,
                installmentAmount = it.installmentAmount.toDouble(),
                startDate         = it.startDate,
                paidCount         = paidCount,
                remainingBalance  = remainingBalance.toDouble(),
            )
        }

        return AccountDetailResponse(
            id                = account.id,
            code              = account.code,
            name              = account.name,
            type              = ApiAccountType.valueOf(account.type.name),
            balance           = balance.toDouble(),
            showInAlerts      = account.showInAlerts,
            thresholdPct      = account.thresholdPct?.toDouble(),
            loanAccount       = loan != null,
            loanId            = loan?.id,
            loanData          = loanData,
            trend             = trend,
            transactions      = txViews.map { it.toItem(account.type) },
            totalTransactions = txTotal,
        )
    }

    fun getTransactions(id: Long, page: Int, size: Int): TransactionPageResponse {
        val userId  = currentUser.id
        val account = accountRepo.findByIdAndUserId(id, userId)
            ?: throw ApiException("NOT_FOUND", "Account not found", org.springframework.http.HttpStatus.NOT_FOUND)

        val offset = page * size
        val items  = journalLineRepo.findTransactions(userId, id, pageSize = size, pageOffset = offset)
        val total  = journalLineRepo.countTransactions(userId, id)

        return TransactionPageResponse(
            items      = items.map { it.toItem(account.type) },
            totalCount = total,
        )
    }

    // Net balance in display terms: positive = normal/healthy for account type
    private fun netBalance(type: AccountType, debit: BigDecimal, credit: BigDecimal): BigDecimal {
        val netDebit = debit - credit
        return when (type) {
            AccountType.ASSET, AccountType.EXPENSE -> netDebit
            else                                   -> netDebit.negate()
        }
    }

    private fun com.kredius.be.repository.TransactionView.toItem(type: AccountType) = TransactionItem(
        id          = id,
        date        = entryDate,
        description = description,
        amountRd    = amountRd.toDouble(),
        inflow      = signedTxValue(type, side, amountRd) > 0,
    )

    @Transactional
    fun create(request: CreateAccountRequest): AccountResponse {
        val account = Account(
            user = currentUser.user,
            code = request.code,
            name = request.name,
            type = AccountType.valueOf(request.type.value),
            thresholdPct = request.thresholdPct?.let { BigDecimal.valueOf(it) },
            showInAlerts = request.showInAlerts ?: false,
        )
        return accountRepo.save(account).toResponse()
    }

    // Positive = beneficial to user's wealth, negative = harmful.
    // ASSET/LIABILITY: DEBIT on ASSET (savings up) = +; CREDIT on LIABILITY (debt up) = -.
    // EXPENSE: DEBIT (spending) = -; INCOME: CREDIT (income) = +.
    private fun signedTxValue(type: AccountType, side: String, amount: BigDecimal): Double {
        val positive = when (type) {
            AccountType.ASSET     -> side == "DEBIT"
            AccountType.LIABILITY -> side == "DEBIT"   // paying down debt = good
            AccountType.EXPENSE   -> side == "CREDIT"  // expense refund = good
            AccountType.INCOME    -> side == "CREDIT"  // income received = good
            AccountType.EQUITY    -> side == "CREDIT"
        }
        return if (positive) amount.toDouble() else -amount.toDouble()
    }

    private fun Account.toResponse(loanAccount: Boolean = false) = AccountResponse(
        id = id,
        code = code,
        name = name,
        type = ApiAccountType.valueOf(type.name),
        thresholdPct = thresholdPct?.toDouble(),
        showInAlerts = showInAlerts,
        active = active,
        loanAccount = loanAccount,
        createdAt = createdAt,
    )
}
