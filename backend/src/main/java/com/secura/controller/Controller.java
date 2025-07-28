package com.secura.controller;

import com.secura.entity.Message;
import com.secura.entity.User;
import com.secura.repository.MessageRepository;
import com.secura.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class Controller {
    final UserRepository userRepository;
    final MessageRepository messageRepository;
    final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody User user) {
        if (userRepository.existsById(user.getUsername())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Username already exists");
        }
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

        // Validate input
        if (username == null || password == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Username and password are required");
        }

        // Check if user exists and password matches
        return userRepository.findById(username).map(user -> {
            if (!user.getPassword().equals(password)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid password");
            }

            // Login successful - update user status
            user.setOnline(true);
            user.setLastSeen(System.currentTimeMillis());

            String keyToHash;
            if (publicKey != null && !publicKey.isEmpty()) {
                keyToHash = publicKey;
            }else {
                keyToHash = "key_" + username + "_" + System.currentTimeMillis();
            }

            // Hash the public key using BCrypt
            String hashedPublicKey = passwordEncoder.encode(keyToHash);
            user.setPublicKey(hashedPublicKey);

            userRepository.save(user);
            String message = forceLogin ? "Forced login successful" : "Login successful";
            return ResponseEntity.ok(Map.of(
                    "message", message,
                    "username", user.getUsername(),
                    "online", user.getOnline()
            ));
        }).orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found"));
    }

    @GetMapping("/users")
    public List<User> getUsers() {
        return userRepository.findAll();
    }

    @PostMapping("/messages")
    public Message sendMessage(@RequestBody Message message) {
        message.setTimestamp(Instant.now());
        return messageRepository.save(message);
    }


    @GetMapping("/messages")
    public List<Message> getMessages(@RequestParam String user) {
        return messageRepository.findByRecipient(user);
    }

    @PostMapping("/presence")
    public ResponseEntity<?> updatePresence(@RequestBody Map<String, Object> payload) {
        String username = (String) payload.get("username");
        Boolean online = (Boolean) payload.get("online");
        return userRepository.findById(username).map(user -> {
            user.setOnline(online);
            user.setLastSeen(System.currentTimeMillis());
            return ResponseEntity.ok(userRepository.save(user));
        }).orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }




}
