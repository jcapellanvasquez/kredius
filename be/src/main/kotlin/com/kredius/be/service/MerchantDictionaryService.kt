package com.kredius.be.service

import com.kredius.be.entity.MerchantDictionary
import com.kredius.be.exception.ApiException
import com.kredius.be.model.CreateMerchantMappingRequest
import com.kredius.be.model.MerchantMappingResponse
import com.kredius.be.model.UpdateMerchantMappingRequest
import com.kredius.be.repository.AccountRepository
import com.kredius.be.repository.MerchantDictionaryRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime

@Service
class MerchantDictionaryService(
    private val dictRepo:    MerchantDictionaryRepository,
    private val accountRepo: AccountRepository,
    private val currentUser: CurrentUserService,
) {
    @Transactional(readOnly = true)
    fun list(): List<MerchantMappingResponse> =
        dictRepo.findByUserIdOrderByTextPatternAsc(currentUser.id).map { it.toResponse() }

    @Transactional
    fun create(req: CreateMerchantMappingRequest): MerchantMappingResponse {
        val pattern = req.pattern.trim().uppercase()
        val userId  = currentUser.id

        if (dictRepo.findByUserIdAndTextPattern(userId, pattern) != null) {
            throw ApiException("CONFLICT", "Pattern '$pattern' already exists", HttpStatus.CONFLICT)
        }

        val account = accountRepo.findByIdAndUserId(req.accountId, userId)
            ?: throw ApiException("NOT_FOUND", "Account ${req.accountId} not found", HttpStatus.NOT_FOUND)

        return dictRepo.save(MerchantDictionary(
            textPattern = pattern,
            account     = account,
            user        = currentUser.user,
        )).toResponse()
    }

    @Transactional
    fun update(id: Long, req: UpdateMerchantMappingRequest): MerchantMappingResponse {
        val userId  = currentUser.id
        val mapping = dictRepo.findByIdAndUserId(id, userId)
            ?: throw ApiException("NOT_FOUND", "Mapping $id not found", HttpStatus.NOT_FOUND)

        val account = accountRepo.findByIdAndUserId(req.accountId, userId)
            ?: throw ApiException("NOT_FOUND", "Account ${req.accountId} not found", HttpStatus.NOT_FOUND)

        mapping.account   = account
        mapping.updatedAt = OffsetDateTime.now()
        return dictRepo.save(mapping).toResponse()
    }

    @Transactional
    fun delete(id: Long) {
        val mapping = dictRepo.findByIdAndUserId(id, currentUser.id)
            ?: throw ApiException("NOT_FOUND", "Mapping $id not found", HttpStatus.NOT_FOUND)
        dictRepo.delete(mapping)
    }

    private fun MerchantDictionary.toResponse() = MerchantMappingResponse(
        id          = id,
        pattern     = textPattern,
        accountId   = account.id,
        accountName = account.name,
    )
}
