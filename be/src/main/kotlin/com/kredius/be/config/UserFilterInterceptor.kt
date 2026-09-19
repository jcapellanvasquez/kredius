package com.kredius.be.config

import com.kredius.be.service.CurrentUserService
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.hibernate.Session
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor

@Component
class UserFilterInterceptor(
    @PersistenceContext private val em: EntityManager,
    private val currentUser: CurrentUserService,
) : HandlerInterceptor {

    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        em.unwrap(Session::class.java)
            .enableFilter("userFilter")
            .setParameter("userId", currentUser.id)
        return true
    }
}
