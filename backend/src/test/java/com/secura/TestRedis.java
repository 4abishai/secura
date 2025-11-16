// PASTE THE FOLLOWING IN THE TERMINAL TO RUN THE TEST
// ./gradlew clean test --tests "com.secura.TestRedis"

package com.secura;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.secura.entity.User;
import com.secura.repository.UserRepository;
import com.secura.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.test.context.TestPropertySource;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TestRedis {

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ReactiveStringRedisTemplate redisTemplate;

    private final String testUsername = "benchmarkUser";
    private static final Logger log = LoggerFactory.getLogger(TestRedis.class);

    @BeforeAll
    void setup() {
        // Verify beans are properly injected
        assertNotNull(userService, "UserService should not be null");
        assertNotNull(userRepository, "UserRepository should not be null");
        assertNotNull(redisTemplate, "RedisTemplate should not be null");

        log.info("Starting test setup...");

        try {
            // Clean Redis cache
            redisTemplate.delete("user:publicKey:" + testUsername).block();
            log.info("Redis cache cleaned");

            // Delete any existing benchmark user
            userRepository.findByUsername(testUsername)
                    .flatMap(userRepository::delete)
                    .block();
            log.info("Existing test user deleted");

            // Create fresh test user
            User user = new User();
            user.setUsername(testUsername);
            user.setPublicKey("sampleKey");
            user.setPassword("dummy");
            User savedUser = userRepository.save(user).block();

            assertNotNull(savedUser, "Test user should be saved");
            log.info("Fresh test user created with username: {}", testUsername);

        } catch (Exception e) {
            log.error("Error during test setup", e);
            throw new RuntimeException("Test setup failed", e);
        }
    }

    @Test
    void benchmarkMongoVsRedis() {
        int iterations = 10;

        log.info("Starting benchmark with {} iterations", iterations);

        try {
            // Warm up - ensure data exists and caches are primed
            String warmupKey = userService.getPublicKey(testUsername).block();
            assertNotNull(warmupKey, "Warmup should return public key");
            log.info("Warmup completed");

            // === MongoDB Benchmark (cache miss) ===
            log.info("Starting MongoDB benchmark (cache miss scenario)...");
            redisTemplate.delete("user:publicKey:" + testUsername).block();

            long mongoStart = System.nanoTime();
            for (int i = 0; i < iterations; i++) {
                String key = userService.getPublicKey(testUsername).block();
                assertNotNull(key, "Public key should not be null");
                redisTemplate.delete("user:publicKey:" + testUsername).block();
            }
            long mongoTime = System.nanoTime() - mongoStart;
            double mongoAvgMs = mongoTime / 1_000_000.0 / iterations;

            // === Redis Benchmark (cache hit) ===
            log.info("Starting Redis benchmark (cache hit scenario)...");
            // Prime the cache
            userService.getPublicKey(testUsername).block();

            long redisStart = System.nanoTime();
            for (int i = 0; i < iterations; i++) {
                String key = userService.getPublicKey(testUsername).block();
                assertNotNull(key, "Public key should not be null");
            }
            long redisTime = System.nanoTime() - redisStart;
            double redisAvgMs = redisTime / 1_000_000.0 / iterations;

            // === Calculate Metrics ===
            double speedup = mongoAvgMs / redisAvgMs;
            double latencyReduction = ((mongoAvgMs - redisAvgMs) / mongoAvgMs) * 100;

            // === Log Results ===
            log.info("========================================");
            log.info("BENCHMARK RESULTS ({} iterations)", iterations);
            log.info("========================================");
            log.info("MongoDB (cache miss) avg: {} ms", String.format("%.3f", mongoAvgMs));
            log.info("Redis (cache hit) avg:    {} ms", String.format("%.3f", redisAvgMs));
            log.info("Speedup:                  {}x", String.format("%.2f", speedup));
            log.info("Latency reduction:        {}%", String.format("%.2f", latencyReduction));
            log.info("Absolute time saved:      {} ms", String.format("%.3f", mongoAvgMs - redisAvgMs));
            log.info("========================================");

            // === Assertions ===
            assertTrue(speedup > 1.0,
                    String.format("Redis should be faster than MongoDB. Speedup: %.2fx", speedup));
            assertTrue(redisAvgMs < mongoAvgMs,
                    String.format("Redis avg (%.3f ms) should be less than MongoDB avg (%.3f ms)",
                            redisAvgMs, mongoAvgMs));

        } catch (Exception e) {
            log.error("Error during benchmark execution", e);
            throw new RuntimeException("Benchmark failed", e);
        }
    }
}