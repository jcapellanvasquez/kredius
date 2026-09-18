package com.kredius.be.exception

import com.kredius.be.model.ErrorResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(ApiException::class)
    fun handleApiException(ex: ApiException): ResponseEntity<ErrorResponse> {
        val error = ErrorResponse(
            code = ex.code,
            message = ex.message,
            details = ex.details.ifEmpty { null }
        )
        return ResponseEntity.status(ex.httpStatus).body(error)
    }

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidationException(ex: MethodArgumentNotValidException): ResponseEntity<ErrorResponse> {
        val details = ex.bindingResult.fieldErrors.map { "${it.field}: ${it.defaultMessage}" }
        val error = ErrorResponse(
            code = "VALIDATION_ERROR",
            message = "Request validation failed",
            details = details
        )
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error)
    }

    @ExceptionHandler(Exception::class)
    fun handleGenericException(ex: Exception): ResponseEntity<ErrorResponse> {
        val error = ErrorResponse(
            code = "INTERNAL_ERROR",
            message = "An unexpected error occurred"
        )
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error)
    }
}
