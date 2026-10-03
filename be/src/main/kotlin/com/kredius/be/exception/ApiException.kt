package com.kredius.be.exception

import org.springframework.http.HttpStatus

class ApiException(
    val code: String,
    override val message: String,
    val httpStatus: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    val details: List<String> = emptyList()
) : RuntimeException(message) {
    companion object {
        val NOT_FOUND = "NOT_FOUND"
        val BAD_REQUEST = "BAD_REQUEST"
        val CONFLICT = "CONFLICT"
        val NO_EXCHANGE_RATE = "NO_EXCHANGE_RATE"
        val INVALID_CATEGORY = "INVALID_CATEGORY"
    }
}
