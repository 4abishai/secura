package com.secura.controller;

import com.secura.entity.Message;
import com.secura.entity.User;
import com.secura.repository.MessageRepository;
import com.secura.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class Controller {
    final UserRepository userRepository;
    final MessageRepository messageRepository;

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody User user) {
        if (userRepository.existsById(user.getUsername())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Username already exists");
        }
        user.setOnline(true);
        user.setLastSeen(System.currentTimeMillis());
        return ResponseEntity.ok(userRepository.save(user));
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
