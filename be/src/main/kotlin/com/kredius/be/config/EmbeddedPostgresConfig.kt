package com.kredius.be.config

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import javax.sql.DataSource

@Configuration
class EmbeddedPostgresConfig {

    @Bean(destroyMethod = "close")
    fun embeddedPostgres(): EmbeddedPostgres = EmbeddedPostgres.builder()
        .setPort(5432)
        .start()

    @Bean
    @Primary
    fun dataSource(embeddedPostgres: EmbeddedPostgres): DataSource = embeddedPostgres.postgresDatabase
}
