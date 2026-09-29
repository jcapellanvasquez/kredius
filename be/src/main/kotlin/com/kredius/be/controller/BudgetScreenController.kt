package com.kredius.be.controller

import com.kredius.be.api.BudgetScreenApi
import com.kredius.be.model.BudgetScreenResponse
import com.kredius.be.service.BudgetScreenService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
class BudgetScreenController(private val budgetScreenService: BudgetScreenService) : BudgetScreenApi {

    override fun getBudgetScreen(period: LocalDate): ResponseEntity<BudgetScreenResponse> =
        ResponseEntity.ok(budgetScreenService.get(period))
}
