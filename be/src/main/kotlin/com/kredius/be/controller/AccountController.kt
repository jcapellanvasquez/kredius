package com.kredius.be.controller

import com.kredius.be.api.AccountsApi
import com.kredius.be.model.AccountResponse
import com.kredius.be.model.AccountSummaryResponse
import com.kredius.be.model.AccountType
import com.kredius.be.model.CreateAccountRequest
import com.kredius.be.service.AccountService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController

@RestController
class AccountController(private val accountService: AccountService) : AccountsApi {

    override fun getAccountsSummary(): ResponseEntity<List<AccountSummaryResponse>> =
        ResponseEntity.ok(accountService.getSummary())

    override fun getAccounts(type: AccountType?): ResponseEntity<List<AccountResponse>> =
        ResponseEntity.ok(accountService.getAll(type))

    override fun createAccount(createAccountRequest: CreateAccountRequest): ResponseEntity<AccountResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(accountService.create(createAccountRequest))
}
