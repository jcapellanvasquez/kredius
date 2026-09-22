package com.kredius.be.repository

import com.kredius.be.entity.MerchantDictionary
import org.springframework.data.jpa.repository.JpaRepository

interface MerchantDictionaryRepository : JpaRepository<MerchantDictionary, Long> {
    fun findByUserId(userId: Long): List<MerchantDictionary>
    fun findByUserIdAndTextPattern(userId: Long, textPattern: String): MerchantDictionary?
}
