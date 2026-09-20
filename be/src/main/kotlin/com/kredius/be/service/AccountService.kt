package com.kredius.be.service

import com.kredius.be.entity.Account
import com.kredius.be.entity.AccountType
import com.kredius.be.entity.InstallmentStatus
import com.kredius.be.model.AccountResponse
import com.kredius.be.model.AccountSummaryResponse
import com.kredius.be.model.CreateAccountRequest
import com.kredius.be.model.LoanFrequency
import com.kredius.be.repository.AccountRepository
import com.kredius.be.repository.JournalLineRepository
import com.kredius.be.repository.LoanRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import com.kredius.be.model.AccountType as ApiAccountType
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
        val loanAccountIds = loanRepo.findLoanAccountIds()
        return accountRepo.findAll()
            .filter { it.active }
            .let { if (type != null) it.filter { a -> a.type == AccountType.valueOf(type.value) } else it }
            .map { it.toResponse(loanAccount = it.id in loanAccountIds) }
    }

    fun getSummary(): List<AccountSummaryResponse> {
        val userId           = currentUser.id
        val loansByAccountId = loanRepo.findAll().filter { it.active }.associateBy { it.account.id }
        val balances         = journalLineRepo.findAccountBalances(userId).associateBy { it.accountId }
        val lastTransactions = journalLineRepo.findLastTransactions(userId).associateBy { it.accountId }

        return accountRepo.findAll()
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
