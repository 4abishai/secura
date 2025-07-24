package com.secura.controller;

import com.secura.dto.MessageRequest;
import com.secura.dto.MessageResponse;
import com.secura.service.MessageService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/messages")
@CrossOrigin(origins = "*") // Configure this properly for production
public class MessageController {

    @Autowired
    private MessageService messageService;

    @PostMapping
    public ResponseEntity<MessageResponse> storeMessage(@Valid @RequestBody MessageRequest request) {
        MessageResponse response = messageService.storeMessage(request);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping("/chat")
    public ResponseEntity<List<MessageResponse>> getMessagesBetweenUsers(
            @RequestParam String user1,
            @RequestParam String user2) {
        List<MessageResponse> messages = messageService.getMessagesBetweenUsers(user1, user2);
        return ResponseEntity.ok(messages);
    }

    @GetMapping("/recipient/{recipientId}")
    public ResponseEntity<List<MessageResponse>> getNewMessagesForRecipient(
            @PathVariable String recipientId,
            @RequestParam(required = false, defaultValue = "0") Long lastMessageId) {
        List<MessageResponse> messages = messageService.getNewMessagesForRecipient(recipientId, lastMessageId);
        return ResponseEntity.ok(messages);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<MessageResponse>> getAllMessagesForUser(@PathVariable String userId) {
        List<MessageResponse> messages = messageService.getAllMessagesForUser(userId);
        return ResponseEntity.ok(messages);
    }

    @GetMapping("/{messageId}")
    public ResponseEntity<MessageResponse> getMessageById(@PathVariable Long messageId) {
        MessageResponse message = messageService.getMessageById(messageId);
        return ResponseEntity.ok(message);
    }
}