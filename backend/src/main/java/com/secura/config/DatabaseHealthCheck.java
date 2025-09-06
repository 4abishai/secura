package com.secura.config;

import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Configuration;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Mono;

@Configuration
public class DatabaseHealthCheck {

    private final DatabaseClient databaseClient;

    public DatabaseHealthCheck(DatabaseClient databaseClient) {
        this.databaseClient = databaseClient;
    }

    @PostConstruct
    public void verifyConnection() {
        // Run a simple query (like SELECT 1) and block for result at startup
        Mono<Integer> result = databaseClient.sql("SELECT 1")
                .map(row -> row.get(0, Integer.class))
                .first();

        try {
            Integer value = result.block(); // only at startup, safe here
            if (value != null && value == 1) {
                System.out.println("✅ Successfully connected to Neon Postgres via R2DBC.");
            } else {
                throw new IllegalStateException("Unexpected result from test query: " + value);
            }
        } catch (Exception e) {
            throw new IllegalStateException("❌ Failed to connect to Neon Postgres via R2DBC", e);
        }
    }
}
