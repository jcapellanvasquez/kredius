package com.kredius.be.controller

import com.kredius.be.api.LoansApi
import com.kredius.be.model.CreateGivenLoanRequest
import com.kredius.be.model.CreateReceivedLoanRequest
import com.kredius.be.model.LoanDetailResponse
import com.kredius.be.model.LoanResponse
import com.kredius.be.model.LoanType
import com.kredius.be.service.LoanService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController

@RestController
class LoanController(private val loanService: LoanService) : LoansApi {

    override fun getLoan(accountId: Long): ResponseEntity<LoanDetailResponse> =
        ResponseEntity.ok(loanService.getOne(accountId))

    override fun collectInstallment(accountId: Long, num: Int): ResponseEntity<LoanDetailResponse> =
        ResponseEntity.ok(loanService.collectInstallment(accountId, num))

    override fun getLoans(type: LoanType?): ResponseEntity<List<LoanResponse>> =
        ResponseEntity.ok(loanService.getAll(type))

    override fun createGivenLoan(createGivenLoanRequest: CreateGivenLoanRequest): ResponseEntity<LoanResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(loanService.createGivenLoan(createGivenLoanRequest))

    override fun createReceivedLoan(createReceivedLoanRequest: CreateReceivedLoanRequest): ResponseEntity<LoanResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(loanService.createReceivedLoan(createReceivedLoanRequest))
}
