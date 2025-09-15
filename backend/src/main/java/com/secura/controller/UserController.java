package com.secura.controller;

import com.secura.entity.User;
import com.secura.repository.UserRepository;
import com.secura.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Map;
@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final UserService userService;

    @PostMapping("/register")
    public Mono<ResponseEntity<?>> registerUser(@RequestBody User user) {
        if (user.getUsername() == null || user.getUsername().isEmpty()) {
            return Mono.just(ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Username is required"));
        }

        if (user.getPassword() == null || user.getPassword().isEmpty()) {
            return Mono.just(ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Password is required"));
        }

        if (user.getPassword().length() > 72) {
            return Mono.just(ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Password cannot be more than 72 characters"));
        }

        return userRepository.existsByUsername(user.getUsername())
                .flatMap(exists -> {
                    if (exists) {
                        return Mono.just(
                                ResponseEntity.status(HttpStatus.CONFLICT)
                                        .body("Username already exists")
                        );
                    }

                    user.setPassword(passwordEncoder.encode(user.getPassword()));
                    user.setOnline(true);
                    user.setLastSeen(System.currentTimeMillis());

                    return userRepository.save(user)
                            .map(savedUser -> ResponseEntity.ok(savedUser));
                })
                .onErrorResume(e -> {
                    log.error("Error during registration", e);
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body("Registration failed"));
                });
    }

    @PostMapping("/login")
    public Mono<ResponseEntity<?>> loginUser(@RequestBody Map<String, String> loginRequest) {
        String username = loginRequest.get("username");
        String password = loginRequest.get("password");
        String publicKey = loginRequest.get("publicKey");
        Boolean forceLogin = Boolean.parseBoolean(loginRequest.getOrDefault("forceLogin", "false"));

        if (username == null || password == null) {
            return Mono.just(ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Username and password are required"));
        }

        return userRepository.findByUsername(username)
                .flatMap(user -> {
                    if (!passwordEncoder.matches(password, user.getPassword())) {
                        return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                .body("Invalid password"));
                    }

                    user.setOnline(true);
                    user.setLastSeen(System.currentTimeMillis());

                    return userService.saveUser(user, publicKey)
                            .map(savedUser -> {
                                String message = forceLogin ? "Forced login successful" : "Login successful";
                                return ResponseEntity.ok(Map.of(
                                        "message", message,
                                        "username", savedUser.getUsername(),
                                        "online", savedUser.getOnline()
                                ));
                            });
                })
                .switchIfEmpty(Mono.just(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("User not found")))
                .onErrorResume(e -> {
                    log.error("Error during login", e);
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body("Login failed"));
                });
    }

    @GetMapping("/users/{username}")
    public Mono<ResponseEntity<Map<String, String>>> getUserPublicInfo(@PathVariable String username) {
        return userService.getPublicKey(username)
                .map(publicKey -> ResponseEntity.ok(Map.of(
                        "username", username,
                        "publicKey", publicKey
                )))
                .switchIfEmpty(Mono.just(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "User not found"))));
    }

    @GetMapping("/users")
    public Flux<User> getUsers() {
        return userRepository.findAll();
    }

    @GetMapping("/health")
    public Mono<ResponseEntity<Map<String, String>>> healthCheck() {
        return Mono.just(ResponseEntity.ok(Map.of(
                "status", "UP",
                "message", "Service is running"
        )));
    }
}
