package com.secura.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.secura.entity.Task;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Sinks;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class TaskNotificationService {

    private final ObjectMapper objectMapper;
    private final Map<String, Sinks.Many<String>> userMessageSinks;

    public void sendDeadlineNotification(Task task) {
        Map<String, Object> notification = new HashMap<>();
        notification.put("type", "deadline_notification");
        notification.put("taskId", task.getId());
        notification.put("taskTitle", task.getTaskTitle());
        notification.put("assignee", task.getAssignee());
        notification.put("assignedBy", task.getAssignedBy());
        notification.put("deadline", task.getDeadline().toString()); // ISO-8601 UTC string
        notification.put("timestamp", Instant.now().toString());
        notification.put("message", "Task '" + task.getTaskTitle() + "' has reached its deadline!");

        // Notify assignee if present
        if (task.getAssignee() != null && !task.getAssignee().isBlank()) {
            sendNotificationToUser(task.getAssignee(), notification);
        }

        // Notify assigner if present (and not same as assignee)
        if (task.getAssignedBy() != null && !task.getAssignedBy().isBlank()
                && !task.getAssignedBy().equals(task.getAssignee())) {
            Map<String, Object> assignerNotification = new HashMap<>(notification);
            assignerNotification.put("message",
                    "Task '" + task.getTaskTitle() + "' assigned to " +
                            (task.getAssignee() != null ? task.getAssignee() : "someone") +
                            " has reached its deadline!");
            sendNotificationToUser(task.getAssignedBy(), assignerNotification);
        }
    }

    private void sendNotificationToUser(String username, Map<String, Object> notification) {
        if (username == null || username.isBlank()) {
            log.warn("No assignee/username provided, skipping notification: {}", notification);
            return;
        }

        Sinks.Many<String> userSink = userMessageSinks.get(username);
        if (userSink != null) {
            try {
                String jsonNotification = objectMapper.writeValueAsString(notification);
                userSink.tryEmitNext(jsonNotification);
                log.info("Sent deadline notification to user: {}", username);
            } catch (Exception e) {
                log.error("Error sending notification to user: {}", username, e);
            }
        } else {
            log.warn("User {} is not connected, cannot send deadline notification", username);
        }
    }


    public void sendCustomNotification(String username, String message) {
        Map<String, Object> notification = new HashMap<>();
        notification.put("type", "custom_notification");
        notification.put("message", message);
        notification.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        sendNotificationToUser(username, notification);
    }
}