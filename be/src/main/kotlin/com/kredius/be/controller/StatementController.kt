package com.kredius.be.controller

import com.kredius.be.api.StatementsApi
import com.kredius.be.model.ConfirmImportResponse
import com.kredius.be.model.PatchStatementLineRequest
import com.kredius.be.model.StatementImportResponse
import com.kredius.be.model.StatementLineDto
import com.kredius.be.model.StatementType
import com.kredius.be.service.StatementService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.time.LocalDate

@RestController
class StatementController(private val statementService: StatementService) : StatementsApi {

    override fun uploadStatement(
        file: MultipartFile,
        accountId: Long,
        type: StatementType,
        statementDate: LocalDate,
    ): ResponseEntity<StatementImportResponse> =
        ResponseEntity.ok(statementService.upload(file, accountId, type, statementDate))

    override fun getStatementImport(id: Long): ResponseEntity<StatementImportResponse> =
        ResponseEntity.ok(statementService.get(id))

    override fun patchStatementLine(
        id: Long,
        patchStatementLineRequest: PatchStatementLineRequest,
    ): ResponseEntity<StatementLineDto> =
        ResponseEntity.ok(statementService.patchLine(id, patchStatementLineRequest))

    @Suppress("UNCHECKED_CAST")
    override fun confirmStatementImport(id: Long): ResponseEntity<ConfirmImportResponse> =
        statementService.confirm(id) as ResponseEntity<ConfirmImportResponse>

    override fun reverseStatementImport(id: Long): ResponseEntity<StatementImportResponse> =
        ResponseEntity.ok(statementService.reverse(id))
}
