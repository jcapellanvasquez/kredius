package com.kredius.be.repository

import com.kredius.be.entity.Account
import com.kredius.be.entity.AccountType
import org.springframework.data.jpa.repository.JpaRepository

interface AccountRepository : JpaRepository<Account, Long> {
    fun findByUserId(userId: Long): List<Account>
    fun findByIdAndUserId(id: Long, userId: Long): Account?
    fun findTopByUserIdAndCodeBetweenOrderByCodeDesc(userId: Long, codeFrom: Int, codeTo: Int): Account?
    fun findByUserIdAndType(userId: Long, type: AccountType): List<Account>
}
