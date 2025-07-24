package com.secura.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@Table(name = "messages")
public class Message {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sender_id")
    private String senderId;

    @Column(name = "recipient_id")
    private String recipientId;

    @Lob
    @Column(name = "encrypted_message", columnDefinition = "TEXT")
    private String encryptedMessage; // JSON string containing encrypted data

    @Column(name = "timestamp")
    private LocalDateTime timestamp;

    @Column(name = "chat_id")
    private String chatId; // For easier querying

    public Message(String senderId, String recipientId, String encryptedMessage) {
        this.senderId = senderId;
        this.recipientId = recipientId;
        this.encryptedMessage = encryptedMessage;
        this.timestamp = LocalDateTime.now();
        this.chatId = generateChatId(senderId, recipientId);
    }

    // Helper method to generate consistent chat IDs
    private String generateChatId(String user1, String user2) {
        return user1.compareTo(user2) < 0 ? user1 + "_" + user2 : user2 + "_" + user1;
    }}