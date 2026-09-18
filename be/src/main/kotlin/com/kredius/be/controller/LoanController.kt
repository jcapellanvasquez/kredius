package com.kredius.be.controller

import com.kredius.be.api.LoansApi
import com.kredius.be.model.CreateLoanRequest
import com.kredius.be.model.LoanResponse
import com.kredius.be.model.LoanStatus
import com.kredius.be.service.LoanService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController

@RestController
class LoanController(private val loanService: LoanService) : LoansApi {

    override fun getLoans(status: LoanStatus?, page: Int?, size: Int?): ResponseEntity<List<LoanResponse>> =
        ResponseEntity.ok(loanService.getAll(status))

    override fun getLoanById(loanId: String): ResponseEntity<LoanResponse> =
        ResponseEntity.ok(loanService.getById(loanId))

    override fun createLoan(createLoanRequest: CreateLoanRequest): ResponseEntity<LoanResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(loanService.create(createLoanRequest))
}
