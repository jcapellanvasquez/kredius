package com.kredius.be.service

import com.kredius.be.entity.InstallmentStatus
import com.kredius.be.entity.Loan
import com.kredius.be.entity.LoanType
import com.kredius.be.model.LoanFrequency
import com.kredius.be.model.LoanResponse
import com.kredius.be.model.LoanType as ApiLoanType
import com.kredius.be.repository.LoanRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal

@Service
@Transactional(readOnly = true)
class LoanService(private val loanRepo: LoanRepository) {

    fun getAll(type: ApiLoanType?): List<LoanResponse> =
        loanRepo.findAll()
            .filter { it.active }
            .let { if (type != null) it.filter { l -> l.type == LoanType.valueOf(type.value) } else it }
            .map { it.toResponse() }

    private fun Loan.toResponse(): LoanResponse {
        val pending = installments.filter { it.status == InstallmentStatus.PENDING }
        val paid    = installments.filter { it.status == InstallmentStatus.PAID }

        val remainingBalance = pending.fold(BigDecimal.ZERO) { acc, i -> acc + i.scheduledAmount }
        val totalAmount      = installments.fold(BigDecimal.ZERO) { acc, i -> acc + i.scheduledAmount }
        val nextDate         = pending.minByOrNull { it.scheduledDate }?.scheduledDate

        return LoanResponse(
            id                 = id,
            type               = ApiLoanType.valueOf(type.name),
            counterpartyName   = counterpartyName,
            accountCode        = account.code,
            accountName        = account.name,
            principal          = principal.toDouble(),
            installmentAmount  = installmentAmount.toDouble(),
            frequency          = LoanFrequency.valueOf(frequency.name),
            totalInstallments  = numInstallments,
            paidInstallments   = paid.size,
            nextInstallmentDate = nextDate,
            remainingBalance   = remainingBalance.toDouble(),
            totalAmount        = totalAmount.toDouble(),
            active             = active,
        )
    }
}
