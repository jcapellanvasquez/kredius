package com.kredius.be.service

import com.kredius.be.entity.StatementImport
import com.kredius.be.entity.StatementImportStatus
import com.kredius.be.entity.StatementLine
import com.kredius.be.exception.ApiException
import com.kredius.be.exception.DuplicateImportException
import com.kredius.be.model.StatementImportResponse
import com.kredius.be.model.StatementImportStatus as ApiStatus
import com.kredius.be.model.StatementLineDto
import com.kredius.be.model.StatementType
import com.kredius.be.parser.BhdPdfParser
import com.kredius.be.repository.AccountRepository
import com.kredius.be.repository.MerchantDictionaryRepository
import com.kredius.be.repository.StatementImportRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.time.LocalDate

@Service
@Transactional
class StatementService(
    private val currentUser: CurrentUserService,
    private val accountRepo: AccountRepository,
    private val importRepo: StatementImportRepository,
    private val merchantRepo: MerchantDictionaryRepository,
    private val parser: BhdPdfParser,
) {
    fun upload(file: MultipartFile, accountId: Long, type: StatementType, statementDate: LocalDate): StatementImportResponse {
        val userId  = currentUser.id
        val account = accountRepo.findByIdAndUserId(accountId, userId)
            ?: throw ApiException("NOT_FOUND", "Account not found", HttpStatus.NOT_FOUND)

        // Duplicate check: reject if a CONFIRMED import already exists
        val existing = importRepo.findByAccountIdAndStatementDateAndStatus(accountId, statementDate, StatementImportStatus.CONFIRMED)
        if (existing != null) throw DuplicateImportException(existing.id)

        val import = StatementImport(
            account       = account,
            type          = com.kredius.be.entity.StatementType.valueOf(type.value),
            statementDate = statementDate,
            fileName      = file.originalFilename,
            status        = StatementImportStatus.UPLOADED,
            user          = currentUser.user,
        )
        importRepo.save(import)

        return try {
            import.status = StatementImportStatus.PROCESSING
            importRepo.save(import)

            val parsed   = parser.parse(file.inputStream)
            val merchants = merchantRepo.findByUserId(userId)
                .associateBy { it.textPattern.uppercase() }

            for (row in parsed) {
                val matchedAccount = merchants.entries
                    .firstOrNull { (pattern, _) -> row.description.uppercase().contains(pattern) }
                    ?.value?.account

                val line = StatementLine(
                    statementImport  = import,
                    lineDate         = row.transactionDate,
                    description      = row.description,
                    currency         = row.currency,
                    amount           = row.amount,
                    isExcluded       = row.isPayment,
                    categoryAccount  = matchedAccount,
                )
                import.lines.add(line)
            }

            import.status = StatementImportStatus.PENDING_REVIEW
            importRepo.save(import)
            import.toResponse()
        } catch (ex: Exception) {
            import.status       = StatementImportStatus.FAILED
            import.errorMessage = ex.message?.take(500)
            importRepo.save(import)
            import.toResponse()
        }
    }

    @Transactional(readOnly = true)
    fun get(id: Long): StatementImportResponse {
        val import = importRepo.findByIdAndUserId(id, currentUser.id)
            ?: throw ApiException("NOT_FOUND", "Statement import not found", HttpStatus.NOT_FOUND)
        return import.toResponse()
    }

    private fun StatementImport.toResponse() = StatementImportResponse(
        id           = id,
        status       = ApiStatus.valueOf(status.name),
        errorMessage = errorMessage,
        lines        = lines.map { it.toDto() },
    )

    private fun StatementLine.toDto() = StatementLineDto(
        id                  = id,
        lineDate            = lineDate,
        description         = description,
        currency            = StatementLineDto.Currency.valueOf(currency.name),
        amount              = amount.toDouble(),
        isExcluded          = isExcluded,
        isPayment           = isExcluded,
        categoryAccountId   = categoryAccount?.id,
        categoryAccountName = categoryAccount?.name,
    )
}
