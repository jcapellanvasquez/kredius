package com.kredius.be.service

import com.kredius.be.entity.*
import com.kredius.be.entity.LoanFrequency as EntityLoanFrequency
import com.kredius.be.exception.ApiException
import com.kredius.be.model.CreateGivenLoanRequest
import com.kredius.be.model.CreateReceivedLoanRequest
import com.kredius.be.model.LoanDetailResponse
import com.kredius.be.model.LoanFrequency
import com.kredius.be.model.LoanInstallmentDto
import com.kredius.be.model.LoanResponse
import com.kredius.be.model.LoanType as ApiLoanType
import org.springframework.http.HttpStatus
import com.kredius.be.repository.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import java.time.LocalDate

@Service
@Transactional(readOnly = true)
class LoanService(
    private val loanRepo:         LoanRepository,
    private val accountRepo:      AccountRepository,
    private val journalEntryRepo: JournalEntryRepository,
    private val journalLineRepo:  JournalLineRepository,
    private val currentUser:      CurrentUserService,
) {
    fun getOne(id: Long): LoanDetailResponse {
        val loan = loanRepo.findByIdAndUserId(id, currentUser.id)
            ?: throw ApiException("NOT_FOUND", "Loan not found", HttpStatus.NOT_FOUND)
        return loan.toDetailResponse()
    }

    fun getAll(type: ApiLoanType?): List<LoanResponse> =
        loanRepo.findByUserId(currentUser.id)
            .filter { it.active }
            .let { if (type != null) it.filter { l -> l.type == LoanType.valueOf(type.value) } else it }
            .map { it.toResponse() }

    @Transactional
    fun createGivenLoan(req: CreateGivenLoanRequest): LoanResponse {
        val user     = currentUser.user
        val userId   = currentUser.id
        val principal = BigDecimal.valueOf(req.principal).setScale(2, RoundingMode.HALF_UP)
        val rate      = BigDecimal.valueOf(req.rate).setScale(3, RoundingMode.HALF_UP)
        val installmentAmt = BigDecimal.valueOf(req.installmentAmount).setScale(2, RoundingMode.HALF_UP)

        val total = principal.multiply(BigDecimal.ONE.add(rate.divide(BigDecimal(100), 6, RoundingMode.HALF_UP)))
            .setScale(2, RoundingMode.HALF_UP)
        val totalLong = total.toLong()
        val instLong  = installmentAmt.toLong()
        val numInst   = if (instLong <= 0) 1 else Math.ceil(totalLong.toDouble() / instLong).toInt()
        val remainder = totalLong % instLong

        val savings = accountRepo.findByUserIdAndType(userId, AccountType.ASSET).firstOrNull()
            ?: error("No asset account for user")
        val nextCode = (accountRepo.findByUserIdAndType(userId, AccountType.ASSET).mapNotNull { it.code }.maxOrNull() ?: 1000) + 1
        val loanAccount = accountRepo.save(Account(
            user = user, code = nextCode,
            name = "Préstamo Dado – ${req.counterpartyName}",
            type = AccountType.ASSET,
        ))

        val disbursement = journalEntryRepo.save(JournalEntry(
            entryDate   = req.startDate,
            description = "Desembolso préstamo dado – ${req.counterpartyName}",
            source      = JournalSource.LOAN,
            user        = user,
        ))
        journalLineRepo.saveAll(listOf(
            JournalLine(journalEntry = disbursement, account = loanAccount, side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = principal, amountRd = principal),
            JournalLine(journalEntry = disbursement, account = savings,     side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = principal, amountRd = principal),
        ))

        val loan = loanRepo.save(Loan(
            account          = loanAccount,
            type             = LoanType.GIVEN,
            counterpartyName = req.counterpartyName,
            principal        = principal,
            rate             = rate,
            frequency        = EntityLoanFrequency.WEEKLY,
            numInstallments  = numInst,
            installmentAmount = installmentAmt,
            startDate        = req.startDate,
            user             = user,
        ))

        val installments = (1..numInst).map { i ->
            val isLast = i == numInst
            val amount = if (isLast && remainder > 0) BigDecimal.valueOf(remainder) else installmentAmt
            LoanInstallment(
                loan            = loan,
                number          = i,
                scheduledDate   = req.startDate.plusWeeks((i - 1).toLong()),
                scheduledAmount = amount,
                status          = InstallmentStatus.PENDING,
            )
        }
        loan.installments.addAll(installments)
        loanRepo.save(loan)

        return loan.toResponse()
    }

    @Transactional
    fun createReceivedLoan(req: CreateReceivedLoanRequest): LoanResponse {
        val user      = currentUser.user
        val userId    = currentUser.id
        val principal = BigDecimal.valueOf(req.principal).setScale(2, RoundingMode.HALF_UP)
        val r         = req.monthlyRate / 100.0
        val n         = req.numInstallments

        val pmt = if (r == 0.0) {
            Math.round(req.principal / n).toDouble()
        } else {
            val rPow = Math.pow(1 + r, n.toDouble())
            Math.round(req.principal * r * rPow / (rPow - 1)).toDouble()
        }
        val pmtBd = BigDecimal.valueOf(pmt).setScale(2, RoundingMode.HALF_UP)

        val savings = accountRepo.findByUserIdAndType(userId, AccountType.ASSET).firstOrNull()
            ?: error("No asset account for user")
        val nextCode = (accountRepo.findByUserIdAndType(userId, AccountType.LIABILITY).mapNotNull { it.code }.maxOrNull() ?: 2000) + 1
        val loanAccount = accountRepo.save(Account(
            user = user, code = nextCode,
            name = "Préstamo Recibido – ${req.counterpartyName}",
            type = AccountType.LIABILITY,
        ))

        val disbursement = journalEntryRepo.save(JournalEntry(
            entryDate   = req.startDate,
            description = "Desembolso préstamo recibido – ${req.counterpartyName}",
            source      = JournalSource.LOAN,
            user        = user,
        ))
        journalLineRepo.saveAll(listOf(
            JournalLine(journalEntry = disbursement, account = savings,     side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = principal, amountRd = principal),
            JournalLine(journalEntry = disbursement, account = loanAccount, side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = principal, amountRd = principal),
        ))

        val loan = loanRepo.save(Loan(
            account          = loanAccount,
            type             = LoanType.RECEIVED,
            counterpartyName = req.counterpartyName,
            principal        = principal,
            rate             = BigDecimal.valueOf(req.monthlyRate).setScale(3, RoundingMode.HALF_UP),
            frequency        = EntityLoanFrequency.MONTHLY,
            numInstallments  = n,
            installmentAmount = pmtBd,
            startDate        = req.startDate,
            user             = user,
        ))

        var balance = req.principal
        val installments = (1..n).map { i ->
            val interest  = Math.round(balance * r)
            val princ     = Math.round(pmt - interest)
            balance = maxOf(0.0, balance - princ)
            LoanInstallment(
                loan               = loan,
                number             = i,
                scheduledDate      = req.startDate.plusMonths((i - 1).toLong()),
                scheduledAmount    = pmtBd,
                scheduledInterest  = BigDecimal.valueOf(interest).setScale(2, RoundingMode.HALF_UP),
                scheduledPrincipal = BigDecimal.valueOf(princ).setScale(2, RoundingMode.HALF_UP),
                status             = InstallmentStatus.PENDING,
            )
        }
        loan.installments.addAll(installments)
        loanRepo.save(loan)

        return loan.toResponse()
    }

    private fun Loan.toResponse(): LoanResponse {
        val pending = installments.filter { it.status == InstallmentStatus.PENDING }
        val paid    = installments.filter { it.status == InstallmentStatus.PAID }

        val remainingBalance = pending.fold(BigDecimal.ZERO) { acc, i -> acc + i.scheduledAmount }
        val totalAmount      = installments.fold(BigDecimal.ZERO) { acc, i -> acc + i.scheduledAmount }
        val nextDate         = pending.minByOrNull { it.scheduledDate }?.scheduledDate

        return LoanResponse(
            id                  = id,
            type                = ApiLoanType.valueOf(type.name),
            counterpartyName    = counterpartyName,
            accountCode         = account.code,
            accountName         = account.name,
            principal           = principal.toDouble(),
            installmentAmount   = installmentAmount.toDouble(),
            frequency           = LoanFrequency.valueOf(frequency.name),
            totalInstallments   = numInstallments,
            paidInstallments    = paid.size,
            nextInstallmentDate = nextDate,
            remainingBalance    = remainingBalance.toDouble(),
            totalAmount         = totalAmount.toDouble(),
            startDate           = startDate,
            active              = active,
        )
    }

    private fun Loan.toDetailResponse(): LoanDetailResponse {
        val base = toResponse()
        val installmentDtos = installments
            .sortedBy { it.number }
            .map { inst ->
                LoanInstallmentDto(
                    number          = inst.number,
                    scheduledDate   = inst.scheduledDate,
                    scheduledAmount = inst.scheduledAmount.toDouble(),
                    status          = LoanInstallmentDto.Status.valueOf(inst.status.name),
                )
            }
        return LoanDetailResponse(
            id                  = base.id,
            type                = base.type,
            counterpartyName    = base.counterpartyName,
            accountCode         = base.accountCode,
            accountName         = base.accountName,
            principal           = base.principal,
            installmentAmount   = base.installmentAmount,
            frequency           = base.frequency,
            totalInstallments   = base.totalInstallments,
            paidInstallments    = base.paidInstallments,
            nextInstallmentDate = base.nextInstallmentDate,
            remainingBalance    = base.remainingBalance,
            totalAmount         = base.totalAmount,
            startDate           = base.startDate,
            active              = base.active,
            installments        = installmentDtos,
        )
    }
}
