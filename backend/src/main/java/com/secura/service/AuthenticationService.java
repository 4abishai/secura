package com.secura.service;

import com.secura.entity.User;
import com.secura.repository.UserRepository;
import com.secura.dto.LoginResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Mono;

@Service
public class AuthenticationService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    private static final Logger logger = LoggerFactory.getLogger(AuthenticationService.class);

    public Mono<LoginResponse> authenticateUser(String username, String password) {
        if (username == null || username.trim().isEmpty()) {
            return Mono.just(new LoginResponse(false, "Username is required"));
        }

        if (password == null || password.trim().isEmpty()) {
            return Mono.just(new LoginResponse(false, "Password is required"));
        }

        return userRepository.findByUsername(username)
                .flatMap(user -> {
                    if (passwordEncoder.matches(password, user.getPassword())) {
                        // Update user online status
                        user.setOnline(true);
                        user.setLastSeen(System.currentTimeMillis());

                        return userRepository.save(user)
                                .map(savedUser -> {
                                    logger.info("Successful login for user: {}", savedUser.getUsername());
                                    return new LoginResponse(true, "Login successful", savedUser.getUsername());
                                });
                    } else {
                        logger.warn("Failed login attempt for user: {}", user.getUsername());
                        return Mono.just(new LoginResponse(false, "Invalid username or password"));
                    }
                })
                .switchIfEmpty(Mono.fromCallable(() -> {
                    logger.warn("Login attempt with non-existent username: {}", username);
                    return new LoginResponse(false, "Invalid username or password");
                }))
                .onErrorResume(throwable -> {
                    logger.error("Error during authentication", throwable);
                    return Mono.just(new LoginResponse(false, "Authentication failed"));
                });
    }

    public Mono<Boolean> isValidUser(String username, String password) {
        return authenticateUser(username, password)
                .map(LoginResponse::isSuccess);
    }

    public Mono<User> getUserByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public Mono<Void> setUserOffline(String username) {
        return userRepository.findByUsername(username)
                .flatMap(user -> {
                    user.setOnline(false);
                    user.setLastSeen(System.currentTimeMillis());
                    return userRepository.save(user);
                })
                .then();
    }
}
