package com.secura.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.secura.entity.Message;
import com.secura.repository.MessageRepository;
import com.secura.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    // Store active WebSocket sessions mapped by username
    private final Map<String, WebSocketSession> userSessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        log.info("WebSocket connection established: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            JsonNode jsonMessage = objectMapper.readTree(message.getPayload());
            String type = jsonMessage.get("type").asText();

            switch (type) {
                case "register":
                    handleUserRegistration(session, jsonMessage);
                    break;
                case "send_message":
                    handleSendMessage(session, jsonMessage);
                    break;
                case "get_messages":
                    handleGetMessages(session, jsonMessage);
                    break;
                case "presence":
                    handlePresenceUpdate(session, jsonMessage);
                    break;
                case "message_ack": // ACK handler
                    handleAckMessage(jsonMessage);
                    break;
                default:
                    sendError(session, "Unknown message type: " + type);
            }
        } catch (Exception e) {
            log.error("Error handling WebSocket message", e);
            sendError(session, "Error processing message: " + e.getMessage());
        }
    }

    private void handleUserRegistration(WebSocketSession session, JsonNode jsonMessage) throws Exception {
        String username = jsonMessage.get("username").asText();

        // Store session for this user
        userSessions.put(username, session);
        session.getAttributes().put("username", username);

        // Update user presence
        userRepository.findById(username).ifPresent(user -> {
            user.setOnline(true);
            user.setLastSeen(System.currentTimeMillis());
            userRepository.save(user);
        });

        // Send confirmation
        Map<String, Object> response = new HashMap<>();
        response.put("type", "registration_success");
        response.put("username", username);
        sendMessage(session, response);

        // Broadcast user online status to all connected users
        broadcastUserPresence(username, true);

        // Send undelivered messages
        List<Message> undelivered = messageRepository.findByRecipientAndDeliveredFalse(username);
        for (Message msg : undelivered) {
            Map<String, Object> msgMap = new HashMap<>();
            msgMap.put("type", "new_message");
            msgMap.put("id", msg.getId());
            msgMap.put("sender", msg.getSender());
            msgMap.put("recipient", msg.getRecipient());
            msgMap.put("content", msg.getContent());
            msgMap.put("timestamp", msg.getTimestamp().toString());
            sendMessage(session, msgMap);
        }
    }

    private void handleSendMessage(WebSocketSession session, JsonNode jsonMessage) throws Exception {
        String sender = (String) session.getAttributes().get("username");
        String recipient = jsonMessage.get("recipient").asText();
        String content = jsonMessage.get("content").asText();
        String tempId = jsonMessage.has("tempId") ? jsonMessage.get("tempId").asText() : null;

        // Save message in DB first
        Message savedMessage = new Message();
        savedMessage.setSender(sender);
        savedMessage.setRecipient(recipient);
        savedMessage.setContent(content);
        savedMessage.setTimestamp(Instant.now());

        WebSocketSession recipientSession = userSessions.get(recipient);
        if (recipientSession != null && recipientSession.isOpen()) {
            savedMessage.setDelivered(true);
        } else {
            savedMessage.setDelivered(false);
        }
        savedMessage = messageRepository.save(savedMessage);

        // Prepare message payload
        Map<String, Object> messageResponse = new HashMap<>();
        messageResponse.put("type", "new_message");
        messageResponse.put("id", savedMessage.getId()); // DB ID for ACK
        messageResponse.put("sender", sender);
        messageResponse.put("recipient", recipient);
        messageResponse.put("content", content);
        messageResponse.put("timestamp", savedMessage.getTimestamp().toString());

        if (recipientSession != null && recipientSession.isOpen()) {
            sendMessage(recipientSession, messageResponse);
        }

        Map<String, Object> confirmation = new HashMap<>();
        confirmation.put("type", "message_sent");
        confirmation.put("tempId", tempId);
        confirmation.put("messageId", savedMessage.getId());
        confirmation.put("delivered", savedMessage.isDelivered());
        sendMessage(session, confirmation);
    }

    // ACK handler
    private void handleAckMessage(JsonNode jsonMessage) {
        Long messageId = jsonMessage.get("messageId").asLong();
        messageRepository.deleteById(messageId);
        log.info("Deleted message with ID {} after ACK", messageId);
    }

    private void handleGetMessages(WebSocketSession session, JsonNode jsonMessage) throws Exception {
        String username = (String) session.getAttributes().get("username");

        List<Message> messages = messageRepository.findByRecipient(username);

        Map<String, Object> response = new HashMap<>();
        response.put("type", "messages_history");
        response.put("messages", messages.stream().map(msg -> {
            Map<String, Object> msgMap = new HashMap<>();
            msgMap.put("id", msg.getId());
            msgMap.put("sender", msg.getSender());
            msgMap.put("recipient", msg.getRecipient());
            msgMap.put("content", msg.getContent());
            msgMap.put("timestamp", msg.getTimestamp().toString());
            return msgMap;
        }).collect(Collectors.toList()));

        sendMessage(session, response);
    }

    private void handlePresenceUpdate(WebSocketSession session, JsonNode jsonMessage) throws Exception {
        String username = (String) session.getAttributes().get("username");
        boolean online = jsonMessage.get("online").asBoolean();

        userRepository.findById(username).ifPresent(user -> {
            user.setOnline(online);
            user.setLastSeen(System.currentTimeMillis());
            userRepository.save(user);
        });

        broadcastUserPresence(username, online);
    }

    private void broadcastUserPresence(String username, boolean online) {
        Map<String, Object> presenceUpdate = new HashMap<>();
        presenceUpdate.put("type", "user_presence");
        presenceUpdate.put("username", username);
        presenceUpdate.put("online", online);
        presenceUpdate.put("lastSeen", System.currentTimeMillis());

        // Broadcast to all connected users except the user whose presence changed
        userSessions.entrySet().forEach(entry -> {
            if (!entry.getKey().equals(username) && entry.getValue().isOpen()) {
                try {
                    sendMessage(entry.getValue(), presenceUpdate);
                } catch (Exception e) {
                    log.error("Error broadcasting presence update", e);
                }
            }
        });
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String username = (String) session.getAttributes().get("username");
        if (username != null) {
            userSessions.remove(username);

            // Update user presence to offline
            userRepository.findById(username).ifPresent(user -> {
                user.setOnline(false);
                user.setLastSeen(System.currentTimeMillis());
                userRepository.save(user);
            });

            // Broadcast user offline status
            broadcastUserPresence(username, false);
        }
        log.info("WebSocket connection closed: {}", session.getId());
    }

    private void sendMessage(WebSocketSession session, Object message) throws Exception {
        if (session.isOpen()) {
            String jsonMessage = objectMapper.writeValueAsString(message);
            session.sendMessage(new TextMessage(jsonMessage));
        }
    }

    private void sendError(WebSocketSession session, String error) {
        try {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("type", "error");
            errorResponse.put("message", error);
            sendMessage(session, errorResponse);
        } catch (Exception e) {
            log.error("Error sending error message", e);
        }
    }
}