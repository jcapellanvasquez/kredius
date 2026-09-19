package com.kredius.be.service

import com.kredius.be.entity.User
import com.kredius.be.repository.UserRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service

@Service
class CurrentUserService(
    private val userRepo: UserRepository,
    @Value("\${default-session-user-id}") private val userId: Long,
) {
    val user: User by lazy {
        userRepo.findById(userId).orElseThrow {
            IllegalStateException("Configured default-session-user-id=$userId not found in database")
        }
    }

    val id: Long get() = user.id
}
