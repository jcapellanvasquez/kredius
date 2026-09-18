package com.kredius.be.controller

import com.kredius.be.api.HealthApi
import com.kredius.be.model.HealthResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController
import java.time.OffsetDateTime

@RestController
class HealthController : HealthApi {
    override fun healthCheck(): ResponseEntity<HealthResponse> =
        ResponseEntity.ok(
            HealthResponse(status = "UP", timestamp = OffsetDateTime.now())
        )
}
