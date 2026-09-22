package com.kredius.be.repository

import com.kredius.be.entity.Account
import com.kredius.be.entity.AccountType
import org.springframework.data.jpa.repository.JpaRepository

interface AccountRepository : JpaRepository<Account, Long> {
    fun findByUserId(userId: Long): List<Account>
    fun findByIdAndUserId(id: Long, userId: Long): Account?
    fun findByCodeBetween(codeAfter: Int, codeBefore: Int): List<Account>
    fun findByUserIdAndType(userId: Long, type: AccountType): List<Account>
}
