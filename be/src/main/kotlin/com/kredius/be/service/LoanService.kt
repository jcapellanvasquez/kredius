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
import com.kredius.be.model.PrincipalPaymentRecord
import com.kredius.be.model.PrincipalPaymentRequest
import com.kredius.be.model.LoanType as ApiLoanType
import org.springframework.http.HttpStatus
import com.kredius.be.repository.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate

@Service
@Transactional(readOnly = true)
class LoanService(
    private val loanRepo:                LoanRepository,
    private val loanInstallmentRepo:     LoanInstallmentRepository,
    private val accountRepo:             AccountRepository,
    private val journalEntryRepo:        JournalEntryRepository,
    private val journalLineRepo:         JournalLineRepository,
    private val principalPaymentRepo:    PrincipalPaymentRepository,
    private val currentUser:             CurrentUserService,
) {
    fun getOne(accountId: Long): LoanDetailResponse {
        val loan = loanRepo.findByAccountIdAndUserId(accountId, currentUser.id)
            ?: throw ApiException("NOT_FOUND", "Loan not found", HttpStatus.NOT_FOUND)
        return loan.toDetailResponse()
    }

    /** "Pagar" / "Cobrar": pays installment [num] for its scheduled amount on [date] (today by default). */
    @Transactional
    fun collectInstallment(accountId: Long, num: Int, date: LocalDate? = null): LoanDetailResponse {
        val loan = loanRepo.findByAccountIdAndUserId(accountId, currentUser.id)
            ?: throw ApiException("NOT_FOUND", "Loan not found", HttpStatus.NOT_FOUND)
        val installment = loan.installments.find { it.number == num }
            ?: throw ApiException("NOT_FOUND", "Installment $num not found", HttpStatus.NOT_FOUND)
        if (installment.status == InstallmentStatus.PAID)
            throw ApiException("CONFLICT", "Installment $num already paid", HttpStatus.CONFLICT)

        payInstallment(loan, installment, installment.scheduledAmount, date ?: LocalDate.now(), savingsAccount())

        return loanRepo.findByAccountIdAndUserId(accountId, currentUser.id)!!.toDetailResponse()
    }

    /**
     * Posts [amount] as a payment of [installment] and marks it PAID. Interest is the scheduled
     * interest (capped at [amount]) and the rest is principal, so the entry always balances.
     * A received loan: DR interest expense + DR loan / CR savings. A given loan: DR savings /
     * CR loan + CR interest income. Returns the entry.
     */
    internal fun payInstallment(
        loan: Loan,
        installment: LoanInstallment,
        amount: BigDecimal,
        date: LocalDate,
        savings: Account,
        source: JournalSource = JournalSource.LOAN,
        referenceId: Long? = null,
    ): JournalEntry {
        val userId = currentUser.id
        val interest = (installment.scheduledInterest ?: BigDecimal.ZERO).min(amount)
        val principal = amount - interest
        val verb = if (loan.type == LoanType.GIVEN) "Cobro" else "Pago"
        val entry = journalEntryRepo.save(JournalEntry(
            entryDate   = date,
            description = "$verb cuota ${installment.number} – ${loan.counterpartyName}",
            source      = source,
            referenceId = referenceId,
            user        = currentUser.user,
            amount      = amount,
        ))
        fun line(account: Account, side: EntrySide, value: BigDecimal) = JournalLine(
            journalEntry = entry, account = account, side = side,
            currency = CurrencyType.RD, originalAmount = value, amountRd = value,
        )
        val hasInterest = interest.signum() > 0
        val lines = when (loan.type) {
            LoanType.GIVEN -> listOfNotNull(
                line(savings, EntrySide.DEBIT, amount),
                line(loan.account, EntrySide.CREDIT, principal).takeIf { principal.signum() > 0 },
                if (hasInterest) line(interestIncomeAccount(userId), EntrySide.CREDIT, interest) else null,
            )
            LoanType.RECEIVED -> listOfNotNull(
                if (hasInterest) line(interestExpenseAccount(userId), EntrySide.DEBIT, interest) else null,
                line(loan.account, EntrySide.DEBIT, principal).takeIf { principal.signum() > 0 },
                line(savings, EntrySide.CREDIT, amount),
            )
        }
        entry.lines += journalLineRepo.saveAll(lines)

        installment.status = InstallmentStatus.PAID
        installment.actualPaymentDate = date
        installment.journalEntry = entry
        loanInstallmentRepo.save(installment)
        return entry
    }

    /** The account savings statements are uploaded for (Account.statementType = SAVINGS). */
    internal fun savingsAccount(): Account =
        accountRepo.findFirstByUserIdAndStatementTypeAndActiveTrueOrderByCodeAsc(currentUser.id, StatementType.SAVINGS)
            ?: throw ApiException("UNPROCESSABLE_ENTITY", "No active savings account (statementType SAVINGS)",
                HttpStatus.UNPROCESSABLE_ENTITY)

    // Found by name; fragile, but matches the seed (plan Q8, point 6).
    private fun interestIncomeAccount(userId: Long) = accountRepo.findByUserIdAndType(userId, AccountType.INCOME)
        .firstOrNull { it.name.contains("Interés", ignoreCase = true) || it.name.contains("Intereses", ignoreCase = true) }
        ?: error("No interest income account for user")

    private fun interestExpenseAccount(userId: Long) = accountRepo.findByUserIdAndType(userId, AccountType.EXPENSE)
        .firstOrNull { it.name.contains("Financiero", ignoreCase = true) || it.name.contains("Interés", ignoreCase = true) }
        ?: error("No financial expense account for user")

    @Transactional
    fun applyPrincipalPayment(accountId: Long, req: PrincipalPaymentRequest): LoanDetailResponse {
        val userId = currentUser.id
        val loan   = loanRepo.findByAccountIdAndUserId(accountId, userId)
            ?: throw ApiException("NOT_FOUND", "Loan not found", HttpStatus.NOT_FOUND)
        if (loan.type != LoanType.RECEIVED)
            throw ApiException("BAD_REQUEST", "Principal payment only applies to received loans", HttpStatus.BAD_REQUEST)

        val pending = loan.installments.filter { it.status == InstallmentStatus.PENDING }.sortedBy { it.number }
        if (pending.isEmpty())
            throw ApiException("BAD_REQUEST", "No pending installments", HttpStatus.BAD_REQUEST)

        val remainingPrincipal = pending.sumOf { it.scheduledPrincipal ?: BigDecimal.ZERO }
        val paymentAmt = BigDecimal.valueOf(req.amount).setScale(2, RoundingMode.HALF_UP)
        if (paymentAmt >= remainingPrincipal)
            throw ApiException("BAD_REQUEST", "Payment amount exceeds remaining principal", HttpStatus.BAD_REQUEST)

        val savings = savingsAccount()

        val entry = journalEntryRepo.save(JournalEntry(
            entryDate   = req.date,
            description = "Abono a capital – ${loan.counterpartyName}",
            source      = JournalSource.LOAN,
            user        = currentUser.user,
        ))
        journalLineRepo.saveAll(listOf(
            JournalLine(journalEntry = entry, account = loan.account, side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = paymentAmt, amountRd = paymentAmt),
            JournalLine(journalEntry = entry, account = savings,      side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = paymentAmt, amountRd = paymentAmt),
        ))

        val newBalance        = remainingPrincipal.toDouble() - req.amount
        val r                 = loan.rate.toDouble() / 100.0
        val currentPmt        = loan.installmentAmount.toDouble()
        val firstPendingDate  = pending.first().scheduledDate
        val lastPaidNum       = loan.installments.filter { it.status == InstallmentStatus.PAID }.maxOfOrNull { it.number } ?: 0
        val remainingN        = pending.size

        val newPmt: Double
        val newN: Int
        when (req.mode) {
            PrincipalPaymentRequest.Mode.REDUCE_TERM -> {
                newPmt = currentPmt
                newN   = if (r == 0.0) Math.ceil(newBalance / newPmt).toInt()
                         else Math.ceil(-Math.log(1 - newBalance * r / newPmt) / Math.log(1 + r)).toInt()
            }
            PrincipalPaymentRequest.Mode.REDUCE_INSTALLMENT -> {
                newN   = remainingN
                newPmt = if (r == 0.0) Math.round(newBalance / newN).toDouble()
                         else Math.round(newBalance * r * Math.pow(1 + r, newN.toDouble()) / (Math.pow(1 + r, newN.toDouble()) - 1)).toDouble()
            }
        }
        val newPmtBd = BigDecimal.valueOf(newPmt).setScale(2, RoundingMode.HALF_UP)

        val effect = when (req.mode) {
            PrincipalPaymentRequest.Mode.REDUCE_TERM        -> PrincipalPaymentEffect.REDUCE_TERM
            PrincipalPaymentRequest.Mode.REDUCE_INSTALLMENT -> PrincipalPaymentEffect.REDUCE_INSTALLMENT
        }

        // Bulk JPQL delete — bypasses PersistentBag; clearAutomatically evicts session cache.
        loanInstallmentRepo.deletePendingByLoanId(loan.id)

        // Use proxy references — session was cleared so entities are detached; getReferenceById
        // gives a managed proxy without re-loading, safe to use as FK parent on new rows.
        val loanRef = loanRepo.getReferenceById(loan.id)
        var balance = newBalance
        val newInstallments = (1..newN).map { i ->
            val interest  = Math.round(balance * r)
            val princ     = Math.round(newPmt - interest)
            balance       = maxOf(0.0, balance - princ)
            LoanInstallment(
                loan               = loanRef,
                number             = lastPaidNum + i,
                scheduledDate      = firstPendingDate.plusMonths((i - 1).toLong()),
                scheduledAmount    = newPmtBd,
                scheduledInterest  = BigDecimal.valueOf(interest).setScale(2, RoundingMode.HALF_UP),
                scheduledPrincipal = BigDecimal.valueOf(princ).setScale(2, RoundingMode.HALF_UP),
                status             = InstallmentStatus.PENDING,
            )
        }
        loanInstallmentRepo.saveAll(newInstallments)

        // Direct JPQL update — no cascade, avoids touching any stale installment references.
        loanRepo.updateInstallmentFields(loan.id, newPmtBd, lastPaidNum + newN)

        principalPaymentRepo.save(PrincipalPayment(
            loan         = loanRef,
            amount       = paymentAmt,
            paymentDate  = req.date,
            effect       = effect,
            journalEntry = entry,
            user         = currentUser.user,
        ))

        return loanRepo.findByAccountIdAndUserId(accountId, userId)!!.toDetailResponse()
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

        val savings = savingsAccount()
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

        // Flat-rate: distribute total interest evenly across installments.
        val totalInterest = principal.multiply(rate.divide(BigDecimal(100), 6, RoundingMode.HALF_UP))
            .setScale(2, RoundingMode.HALF_UP)
        val interestPerInst = if (numInst > 0) totalInterest.divide(BigDecimal(numInst), 2, RoundingMode.HALF_UP) else BigDecimal.ZERO
        var interestAccumulated = BigDecimal.ZERO

        val installments = (1..numInst).map { i ->
            val isLast = i == numInst
            val amount = if (isLast && remainder > 0) BigDecimal.valueOf(remainder) else installmentAmt
            val instInterest = if (isLast) (totalInterest - interestAccumulated).setScale(2, RoundingMode.HALF_UP) else interestPerInst
            val instPrincipal = (amount - instInterest).setScale(2, RoundingMode.HALF_UP)
            interestAccumulated = interestAccumulated.add(instInterest)
            LoanInstallment(
                loan               = loan,
                number             = i,
                scheduledDate      = req.startDate.plusWeeks((i - 1).toLong()),
                scheduledAmount    = amount,
                scheduledInterest  = instInterest,
                scheduledPrincipal = instPrincipal,
                status             = InstallmentStatus.PENDING,
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

        val savings = savingsAccount()
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
            rate                = rate.toDouble(),
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
        val pending = installments.filter { it.status == InstallmentStatus.PENDING }
        val remainingPrincipal = if (type == LoanType.RECEIVED)
            pending.sumOf { it.scheduledPrincipal ?: BigDecimal.ZERO }.toDouble()
        else null
        val principalPayments = if (type == LoanType.RECEIVED)
            principalPaymentRepo.findByLoanIdOrderByPaymentDateDesc(id)
                .map { PrincipalPaymentRecord(date = it.paymentDate, amount = it.amount.toDouble()) }
        else null
        val installmentDtos = installments
            .sortedBy { it.number }
            .map { inst ->
                LoanInstallmentDto(
                    number             = inst.number,
                    scheduledDate      = inst.scheduledDate,
                    scheduledAmount    = inst.scheduledAmount.toDouble(),
                    scheduledInterest  = inst.scheduledInterest?.toDouble(),
                    scheduledPrincipal = inst.scheduledPrincipal?.toDouble(),
                    status             = LoanInstallmentDto.Status.valueOf(inst.status.name),
                )
            }
        return LoanDetailResponse(
            id                  = base.id,
            type                = base.type,
            counterpartyName    = base.counterpartyName,
            accountCode         = base.accountCode,
            accountName         = base.accountName,
            principal           = base.principal,
            rate                = base.rate,
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
            remainingPrincipal  = remainingPrincipal,
            principalPayments   = principalPayments,
        )
    }
}
