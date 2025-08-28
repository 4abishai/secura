package com.secura.controller;

import com.secura.entity.User;
import com.secura.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody User user) {
        if (userRepository.existsById(user.getUsername())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Username already exists");
        }

        if (user.getPassword().length() > 72) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Password cannot be more than 72 characters");
        }

        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setOnline(true);
        user.setLastSeen(System.currentTimeMillis());
        return ResponseEntity.ok(userRepository.save(user));
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody Map<String, String> loginRequest) {
        String username = loginRequest.get("username");
        String password = loginRequest.get("password");
        String publicKey = loginRequest.get("publicKey");
        Boolean forceLogin = Boolean.parseBoolean(loginRequest.getOrDefault("forceLogin", "false"));

        if (username == null || password == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Username and password are required");
        }

        return userRepository.findById(username).map(user -> {
            if (!passwordEncoder.matches(password, user.getPassword())) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid password");
            }

            user.setOnline(true);
            user.setLastSeen(System.currentTimeMillis());

            if (publicKey != null && !publicKey.isEmpty()) {
                user.setPublicKey(publicKey);
            }

            userRepository.save(user);

            String message = forceLogin ? "Forced login successful" : "Login successful";
            return ResponseEntity.ok(Map.of(
                    "message", message,
                    "username", user.getUsername(),
                    "online", user.getOnline()
            ));
        }).orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found"));
    }

    @GetMapping("/users/{username}")
    public ResponseEntity<Map<String, String>> getUserPublicInfo(@PathVariable String username) {
        return userRepository.findById(username)
                .map(user -> ResponseEntity.ok(Map.of(
                        "username", user.getUsername(),
                        "publicKey", user.getPublicKey()
                )))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "User not found")));
    }

    @GetMapping("/users")
    public List<User> getUsers() {
        return userRepository.findAll();
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "message", "Service is running"
        ));
    }
}