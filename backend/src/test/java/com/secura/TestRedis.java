package com.secura;

// PASTE THE FOLLOWING IN THE TERMINAL
// ./gradlew clean test --tests "com.secura.TestRedis"

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

import static org.junit.jupiter.api.Assertions.assertTrue;


@SpringBootTest()
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
        // Clean Redis cache
        redisTemplate.delete("user:publicKey:" + testUsername).block();

        // Delete any existing benchmark user
        userRepository.findByUsername(testUsername)
                .flatMap(userRepository::delete)
                .block();

        // Create fresh test user
        User user = new User();
        user.setUsername(testUsername);
        user.setPublicKey("sampleKey");
        user.setPassword("dummy");
        userRepository.save(user).block();
    }


    @Test
    void benchmarkMongoVsRedis() {
        int iterations = 10;

        // Warm up Mongo & Redis
        userService.getPublicKey(testUsername).block();

        // Mongo benchmark
        redisTemplate.delete("user:publicKey:" + testUsername).block();
        long mongoStart = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            userService.getPublicKey(testUsername).block();
            redisTemplate.delete("user:publicKey:" + testUsername).block();
        }
        double mongoAvgMs = (System.nanoTime() - mongoStart) / 1_000_000.0 / iterations;

        // Redis benchmark
        userService.getPublicKey(testUsername).block();
        long redisStart = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            userService.getPublicKey(testUsername).block();
        }
        double redisAvgMs = (System.nanoTime() - redisStart) / 1_000_000.0 / iterations;

        double speedup = mongoAvgMs / redisAvgMs;
        double latencyReduction = ((mongoAvgMs - redisAvgMs) / mongoAvgMs) * 100;

        log.info("Mongo avg: {} ms", mongoAvgMs);
        log.info("Redis avg: {} ms", redisAvgMs);
        log.info("Speedup: {}x", speedup);
        log.info("Latency reduction: {}%", latencyReduction);

        assertTrue(speedup > 1, "Redis should be faster than Mongo");
    }
}