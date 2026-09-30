package com.kredius.be.controller

import com.kredius.be.api.ExchangeRatesApi
import com.kredius.be.model.SaveExchangeRateRequest
import com.kredius.be.model.SaveExchangeRateResponse
import com.kredius.be.service.StatementService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController

@RestController
class ExchangeRateController(private val statementService: StatementService) : ExchangeRatesApi {

    override fun saveExchangeRate(saveExchangeRateRequest: SaveExchangeRateRequest): ResponseEntity<SaveExchangeRateResponse> =
        ResponseEntity.ok(statementService.saveCardUsdRate(saveExchangeRateRequest))
}
