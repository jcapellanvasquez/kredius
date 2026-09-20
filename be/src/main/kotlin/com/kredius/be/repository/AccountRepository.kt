package com.kredius.be.repository

import com.kredius.be.entity.Account
import org.springframework.data.jpa.repository.JpaRepository

interface AccountRepository : JpaRepository<Account, Long> {
    fun findByUserId(userId: Long): List<Account>
    fun findByIdAndUserId(id: Long, userId: Long): Account?
}
