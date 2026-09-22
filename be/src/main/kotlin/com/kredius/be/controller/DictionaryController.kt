package com.kredius.be.controller

import com.kredius.be.api.DictionaryApi
import com.kredius.be.model.CreateMerchantMappingRequest
import com.kredius.be.model.MerchantMappingResponse
import com.kredius.be.model.UpdateMerchantMappingRequest
import com.kredius.be.service.MerchantDictionaryService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController

@RestController
class DictionaryController(private val service: MerchantDictionaryService) : DictionaryApi {

    override fun listMerchantMappings(): ResponseEntity<List<MerchantMappingResponse>> =
        ResponseEntity.ok(service.list())

    override fun createMerchantMapping(createMerchantMappingRequest: CreateMerchantMappingRequest): ResponseEntity<MerchantMappingResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.create(createMerchantMappingRequest))

    override fun updateMerchantMapping(id: Long, updateMerchantMappingRequest: UpdateMerchantMappingRequest): ResponseEntity<MerchantMappingResponse> =
        ResponseEntity.ok(service.update(id, updateMerchantMappingRequest))

    override fun deleteMerchantMapping(id: Long): ResponseEntity<Unit> {
        service.delete(id)
        return ResponseEntity.noContent().build()
    }
}
