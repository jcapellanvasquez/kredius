package com.kredius.be.config

import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.CorsRegistry
import org.springframework.web.servlet.config.annotation.InterceptorRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@Configuration
class WebConfig(private val userFilterInterceptor: UserFilterInterceptor) : WebMvcConfigurer {

    override fun addCorsMappings(registry: CorsRegistry) {
        registry.addMapping("/**")
            .allowedOriginPatterns("*")
            .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(true)
    }

    override fun addInterceptors(registry: InterceptorRegistry) {
        // Order Int.MAX_VALUE ensures this runs after OpenEntityManagerInViewInterceptor
        // so the Hibernate Session is already open when we enable the filter.
        registry.addInterceptor(userFilterInterceptor).order(Int.MAX_VALUE)
    }
}
