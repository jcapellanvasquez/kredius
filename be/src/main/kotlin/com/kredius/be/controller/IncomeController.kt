package com.kredius.be.controller

import com.kredius.be.api.IncomeApi
import com.kredius.be.model.CreateIncomeEntryRequest
import com.kredius.be.model.IncomeEntryResponse
import com.kredius.be.service.IncomeService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController

@RestController
class IncomeController(private val incomeService: IncomeService) : IncomeApi {

    override fun listIncomeEntries(): ResponseEntity<List<IncomeEntryResponse>> =
        ResponseEntity.ok(incomeService.listIncomeEntries())

    override fun createIncomeEntry(createIncomeEntryRequest: CreateIncomeEntryRequest): ResponseEntity<IncomeEntryResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(incomeService.createIncomeEntry(createIncomeEntryRequest))
}
