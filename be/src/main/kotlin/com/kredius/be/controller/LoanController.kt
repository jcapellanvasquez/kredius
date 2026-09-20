package com.kredius.be.controller

import com.kredius.be.api.LoansApi
import com.kredius.be.model.LoanResponse
import com.kredius.be.model.LoanType
import com.kredius.be.service.LoanService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController

@RestController
class LoanController(private val loanService: LoanService) : LoansApi {

    override fun getLoans(type: LoanType?): ResponseEntity<List<LoanResponse>> =
        ResponseEntity.ok(loanService.getAll(type))
}
