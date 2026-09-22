package com.kredius.be.controller

import com.kredius.be.api.ReportsApi
import com.kredius.be.model.BatchBudgetUpdateRequest
import com.kredius.be.model.BudgetReportResponse
import com.kredius.be.service.ReportService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
class ReportController(private val reportService: ReportService) : ReportsApi {

    override fun getBudgetReport(period: LocalDate): ResponseEntity<BudgetReportResponse> =
        ResponseEntity.ok(reportService.getBudgetReport(period))

    override fun batchUpdateBudgets(batchBudgetUpdateRequest: BatchBudgetUpdateRequest): ResponseEntity<BudgetReportResponse> =
        ResponseEntity.ok(reportService.batchUpdateBudgets(batchBudgetUpdateRequest))
}
