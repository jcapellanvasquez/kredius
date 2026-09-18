package com.kredius.be.service

import com.kredius.be.exception.ApiException
import com.kredius.be.model.CreateLoanRequest
import com.kredius.be.model.LoanResponse
import com.kredius.be.model.LoanStatus
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import java.time.OffsetDateTime
import java.util.UUID

@Service
class LoanService {

    // In-memory store — replace with a JPA repository when persistence is added
    private val loans = mutableListOf<LoanResponse>()

    fun getAll(status: LoanStatus?): List<LoanResponse> =
        if (status != null) loans.filter { it.status == status } else loans.toList()

    fun getById(loanId: String): LoanResponse =
        loans.find { it.id == loanId }
            ?: throw ApiException("LOAN_NOT_FOUND", "Loan not found: $loanId", HttpStatus.NOT_FOUND)

    fun create(request: CreateLoanRequest): LoanResponse {
        val loan = LoanResponse(
            id = UUID.randomUUID().toString(),
            amount = request.amount,
            term = request.term,
            interestRate = 5.5,
            status = LoanStatus.PENDING,
            createdAt = OffsetDateTime.now()
        )
        loans.add(loan)
        return loan
    }
}
