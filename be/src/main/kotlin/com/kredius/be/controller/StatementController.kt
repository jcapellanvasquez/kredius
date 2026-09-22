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

    // Phase 3 — implemented in next phase
    override fun patchStatementLine(
        id: Long,
        patchStatementLineRequest: PatchStatementLineRequest,
    ): ResponseEntity<StatementLineDto> = super.patchStatementLine(id, patchStatementLineRequest)

    // Phase 4 — implemented in next phase
    override fun confirmStatementImport(id: Long): ResponseEntity<ConfirmImportResponse> =
        super.confirmStatementImport(id)

    override fun reverseStatementImport(id: Long): ResponseEntity<StatementImportResponse> =
        super.reverseStatementImport(id)
}
