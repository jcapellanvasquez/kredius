package com.kredius.be.exception

import com.kredius.be.model.DuplicateImportError
import com.kredius.be.model.ErrorResponse
import org.slf4j.LoggerFactory
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.context.request.WebRequest
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler

@RestControllerAdvice
class GlobalExceptionHandler : ResponseEntityExceptionHandler() {

    private val log = LoggerFactory.getLogger(GlobalExceptionHandler::class.java)

    @ExceptionHandler(DuplicateImportException::class)
    fun handleDuplicateImport(ex: DuplicateImportException): ResponseEntity<DuplicateImportError> =
        ResponseEntity.status(HttpStatus.CONFLICT).body(
            DuplicateImportError(error = "duplicate_confirmed_import", existingImportId = ex.existingImportId)
        )

    @ExceptionHandler(ApiException::class)
    fun handleApiException(ex: ApiException): ResponseEntity<ErrorResponse> {
        val error = ErrorResponse(
            code = ex.code,
            message = ex.message,
            details = ex.details.ifEmpty { null }
        )
        return ResponseEntity.status(ex.httpStatus).body(error)
    }

    // Override parent to use our ErrorResponse format for validation errors
    override fun handleMethodArgumentNotValid(
        ex: MethodArgumentNotValidException,
        headers: HttpHeaders,
        status: HttpStatusCode,
        request: WebRequest
    ): ResponseEntity<Any> {
        val details = ex.bindingResult.fieldErrors.map { "${it.field}: ${it.defaultMessage}" }
        val error = ErrorResponse(
            code = "VALIDATION_ERROR",
            message = "Request validation failed",
            details = details
        )
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error)
    }

    // Catches truly unexpected exceptions — Spring MVC exceptions (404, 405, etc.)
    // are handled by the parent class with correct status codes before reaching here
    @ExceptionHandler(Exception::class)
    fun handleGenericException(ex: Exception): ResponseEntity<ErrorResponse> {
        log.error("Unhandled exception", ex)
        val error = ErrorResponse(
            code = "INTERNAL_ERROR",
            message = "An unexpected error occurred"
        )
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error)
    }
}
