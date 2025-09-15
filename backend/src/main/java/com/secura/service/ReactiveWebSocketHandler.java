package com.secura.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.secura.entity.Message;
import com.secura.entity.Task;
import com.secura.repository.MessageRepository;
import com.secura.repository.TaskRepository;
import com.secura.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReactiveWebSocketHandler implements WebSocketHandler {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final TaskRepository taskRepository;
    private final ObjectMapper objectMapper;
    private final Map<String, Sinks.Many<String>> userMessageSinks;
    private final Map<String, WebSocketSession> userSessions = new ConcurrentHashMap<>();

    @Override
    public Mono<Void> handle(WebSocketSession session) {
        Sinks.Many<String> messageSink = Sinks.many().multicast().onBackpressureBuffer();

        Mono<Void> input = session.receive()
                .map(WebSocketMessage::getPayloadAsText)
                .flatMap(payload -> handleMessage(session, payload, messageSink))
                .doOnError(error -> log.error("Error in WebSocket input stream", error))
                .then();

        Mono<Void> output = session.send(
                messageSink.asFlux()
                        .map(session::textMessage)
                        .doOnError(error -> log.error("Error in WebSocket output stream", error))
        );

        return Mono.zip(input, output)
                .doOnSubscribe(subscription -> log.info("WebSocket connection established: {}", session.getId()))
                .doFinally(signalType -> {
                    handleConnectionClosed(session);
                    messageSink.tryEmitComplete();
                    log.info("WebSocket connection closed: {}", session.getId());
                })
                .then();
    }

    private Mono<Void> handleMessage(WebSocketSession session, String payload, Sinks.Many<String> messageSink) {
        return Mono.fromCallable(() -> {
                    try {
                        JsonNode jsonMessage = objectMapper.readTree(payload);
                        String type = jsonMessage.get("type").asText();

                        switch (type) {
                            case "register":
                                return handleUserRegistration(session, jsonMessage, messageSink);
                            case "send_message":
                                return handleSendMessage(session, jsonMessage);
                            case "get_messages":
                                return handleGetMessages(session, jsonMessage, messageSink);
                            case "presence":
                                return handlePresenceUpdate(session, jsonMessage);
                            case "message_ack":
                                return handleAckMessage(jsonMessage);
                            case "get_pending_tasks":
                                return handleGetPendingTasks(session, jsonMessage, messageSink);
                            default:
                                return sendError(messageSink, "Unknown message type: " + type);
                        }
                    } catch (Exception e) {
                        log.error("Error parsing WebSocket message", e);
                        return sendError(messageSink, "Error processing message: " + e.getMessage());
                    }
                })
                .flatMap(mono -> mono)
                .onErrorResume(error -> {
                    log.error("Error handling WebSocket message", error);
                    return sendError(messageSink, "Internal error occurred");
                });
    }

    private Mono<Void> handleGetPendingTasks(WebSocketSession session, JsonNode jsonMessage, Sinks.Many<String> messageSink) {
        String username = (String) session.getAttributes().get("username");

        return taskRepository.findByAssigneeAndStatus(username, Task.Status.PENDING)
                .collectList()
                .flatMap(tasks -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("type", "pending_tasks");
                    response.put("tasks", tasks.stream().map(task -> {
                        Map<String, Object> taskMap = new HashMap<>();
                        taskMap.put("id", task.getId());
                        taskMap.put("taskTitle", task.getTaskTitle());
                        taskMap.put("deadline", task.getDeadline().toString());
                        taskMap.put("assignedBy", task.getAssignedBy());
                        taskMap.put("status", task.getStatus().toString());
                        return taskMap;
                    }).toList());

                    return sendMessage(messageSink, response);
                });
    }

    private Mono<Void> handleUserRegistration(WebSocketSession session, JsonNode jsonMessage, Sinks.Many<String> messageSink) {
        String username = jsonMessage.get("username").asText();

        userSessions.put(username, session);
        userMessageSinks.put(username, messageSink);
        session.getAttributes().put("username", username);

        // Lookup user by username, not ID
        return userRepository.findByUsername(username)
                .flatMap(user -> {
                    user.setOnline(true);
                    user.setLastSeen(System.currentTimeMillis());
                    return userRepository.save(user);
                })
                .then(Mono.fromCallable(() -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("type", "registration_success");
                    response.put("username", username);
                    return response;
                }))
                .flatMap(response -> sendMessage(messageSink, response))
                .then(broadcastUserPresence(username, true))
                .then(sendUndeliveredMessages(username, messageSink));
    }

    private Mono<Void> sendUndeliveredMessages(String username, Sinks.Many<String> messageSink) {
        return messageRepository.findByRecipientAndDeliveredFalse(username)
                .flatMap(msg -> {
                    Map<String, Object> msgMap = new HashMap<>();
                    msgMap.put("type", "new_message");
                    msgMap.put("id", msg.getId());
                    msgMap.put("sender", msg.getSender());
                    msgMap.put("recipient", msg.getRecipient());
                    msgMap.put("content", msg.getContent());
                    msgMap.put("timestamp", msg.getTimestamp().toString());
                    return sendMessage(messageSink, msgMap);
                })
                .then();
    }

    private Mono<Void> handleSendMessage(WebSocketSession session, JsonNode jsonMessage) {
        String sender = (String) session.getAttributes().get("username");
        String recipient = jsonMessage.get("recipient").asText();
        String content = jsonMessage.get("content").asText();
        String tempId = jsonMessage.has("tempId") ? jsonMessage.get("tempId").asText() : null;

        Message newMessage = new Message();
        newMessage.setSender(sender);
        newMessage.setRecipient(recipient);
        newMessage.setContent(content);
        newMessage.setTimestamp(Instant.now());

        boolean isRecipientOnline = userSessions.containsKey(recipient) &&
                userSessions.get(recipient).isOpen();
        newMessage.setDelivered(isRecipientOnline);

        return messageRepository.save(newMessage)
                .flatMap(savedMessage -> {
                    Map<String, Object> messageResponse = new HashMap<>();
                    messageResponse.put("type", "new_message");
                    messageResponse.put("id", savedMessage.getId());
                    messageResponse.put("sender", sender);
                    messageResponse.put("recipient", recipient);
                    messageResponse.put("content", content);
                    messageResponse.put("timestamp", savedMessage.getTimestamp().toString());

                    Mono<Void> sendToRecipient = Mono.empty();
                    if (isRecipientOnline) {
                        Sinks.Many<String> recipientSink = userMessageSinks.get(recipient);
                        if (recipientSink != null) {
                            sendToRecipient = sendMessage(recipientSink, messageResponse);
                        }
                    }

                    Map<String, Object> confirmation = new HashMap<>();
                    confirmation.put("type", "message_sent");
                    confirmation.put("tempId", tempId);
                    confirmation.put("messageId", savedMessage.getId());
                    confirmation.put("delivered", savedMessage.getDelivered());

                    Sinks.Many<String> senderSink = userMessageSinks.get(sender);
                    Mono<Void> sendConfirmation = senderSink != null ? sendMessage(senderSink, confirmation) : Mono.empty();

                    return Mono.when(sendToRecipient, sendConfirmation);
                });
    }

    private Mono<Void> handleAckMessage(JsonNode jsonMessage) {
        String messageId = jsonMessage.get("messageId").asText();
        return messageRepository.deleteById(messageId)
                .doOnSuccess(unused -> log.info("Deleted message with ID {} after ACK", messageId));
    }

    private Mono<Void> handleGetMessages(WebSocketSession session, JsonNode jsonMessage, Sinks.Many<String> messageSink) {
        String username = (String) session.getAttributes().get("username");

        return messageRepository.findByRecipient(username)
                .collectList()
                .flatMap(messages -> {
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
                    }).toList());

                    return sendMessage(messageSink, response);
                });
    }

    private Mono<Void> handlePresenceUpdate(WebSocketSession session, JsonNode jsonMessage) {
        String username = (String) session.getAttributes().get("username");
        boolean online = jsonMessage.get("online").asBoolean();

        return userRepository.findByUsername(username)
                .flatMap(user -> {
                    user.setOnline(online);
                    user.setLastSeen(System.currentTimeMillis());
                    return userRepository.save(user);
                })
                .then(broadcastUserPresence(username, online));
    }

    private Mono<Void> broadcastUserPresence(String username, boolean online) {
        Map<String, Object> presenceUpdate = new HashMap<>();
        presenceUpdate.put("type", "user_presence");
        presenceUpdate.put("username", username);
        presenceUpdate.put("online", online);
        presenceUpdate.put("lastSeen", System.currentTimeMillis());

        return Flux.fromIterable(userMessageSinks.entrySet())
                .filter(entry -> !entry.getKey().equals(username))
                .flatMap(entry -> sendMessage(entry.getValue(), presenceUpdate))
                .then();
    }

    private void handleConnectionClosed(WebSocketSession session) {
        String username = (String) session.getAttributes().get("username");
        if (username != null) {
            userSessions.remove(username);
            userMessageSinks.remove(username);

            userRepository.findByUsername(username)
                    .flatMap(user -> {
                        user.setOnline(false);
                        user.setLastSeen(System.currentTimeMillis());
                        return userRepository.save(user);
                    })
                    .then(broadcastUserPresence(username, false))
                    .subscribe(unused -> {}, error -> log.error("Error updating user offline status", error));
        }
    }

    private Mono<Void> sendMessage(Sinks.Many<String> messageSink, Object message) {
        return Mono.fromCallable(() -> {
            try {
                String jsonMessage = objectMapper.writeValueAsString(message);
                messageSink.tryEmitNext(jsonMessage);
                return null;
            } catch (Exception e) {
                log.error("Error serializing message", e);
                throw new RuntimeException("Failed to serialize message", e);
            }
        }).then();
    }

    private Mono<Void> sendError(Sinks.Many<String> messageSink, String error) {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("type", "error");
        errorResponse.put("message", error);
        return sendMessage(messageSink, errorResponse);
    }
}
