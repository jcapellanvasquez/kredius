package com.kredius.be.exception

import org.springframework.http.HttpStatus

class ApiException(
    val code: String,
    override val message: String,
    val httpStatus: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    val details: List<String> = emptyList()
) : RuntimeException(message)
