package com.secura.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.secura.dto.ExtractTaskRequest;
import com.secura.dto.LLMResponseDTO;
import com.secura.entity.Task;
import com.secura.repository.TaskRepository;
import com.secura.service.TaskSchedulerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class LLMController {
    @Value("${groq.api.key}")
    private String groqApiKey;
    private final WebClient webClient;
    private final TaskRepository taskRepository;
    private final TaskSchedulerService taskSchedulerService;

    @PostMapping("/tasks/extract")
    public Mono<ResponseEntity<Task>> extractTaskFromMessages(
            @RequestBody ExtractTaskRequest request) {

        List<Map<String, String>> textList = request.getMessages();
        if (textList == null || textList.isEmpty()) {
            return Mono.just(ResponseEntity.badRequest().build());
        }

        String clientTimezoneId = (request.getTimezone() != null && !request.getTimezone().isEmpty())
                ? request.getTimezone().get(0)
                : ZoneId.systemDefault().toString();

        ZoneId tempZone;
        try {
            tempZone = ZoneId.of(clientTimezoneId);
        } catch (Exception e) {
            log.warn("Invalid timezone provided: {}, using system default", clientTimezoneId);
            tempZone = ZoneId.systemDefault();
        }
        final ZoneId clientZone = tempZone;

        // Get current date/time information in client's timezone
        ZonedDateTime clientNow = ZonedDateTime.now(clientZone);
        ZonedDateTime utcNow = ZonedDateTime.now(ZoneOffset.UTC);

        DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy");
        DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("h:mm a z");
        DateTimeFormatter isoFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX");

        String currentDate = clientNow.format(dateFormatter);
        String currentTime = clientNow.format(timeFormatter);
        String currentIsoDateTime = clientNow.format(isoFormatter);
        String utcIsoDateTime = utcNow.format(isoFormatter);

        // Combine the conversation
        StringBuilder conversation = new StringBuilder();
        for (Map<String, String> msg : textList) {
            String sender = msg.getOrDefault("sender", "Unknown");
            String content = msg.getOrDefault("content", "");
            conversation.append(sender).append(": ").append(content).append("\n");
        }

        // Enhanced prompt with timezone context
        String prompt = String.format(
                "Client's Local Date: %s\n" +
                        "Client's Local Time: %s\n" +
                        "Client's Local ISO DateTime: %s\n" +
                        "Client's Timezone: %s\n" +
                        "UTC ISO DateTime: %s\n\n" +
                        "Extract a single task from the following conversation. " +
                        "The user is speaking in their local timezone (%s). When they say 'Monday', 'tomorrow', " +
                        "'next week', '5 mins from now', etc., they mean in their local time. " +
                        "Convert ALL relative dates to absolute ISO 8601 format in the CLIENT'S LOCAL TIMEZONE " +
                        "(include the timezone offset like +05:30 or -07:00). " +
                        "Return valid JSON with keys: task_title, deadline (ISO 8601 format with timezone offset, else null), " +
                        "assignee (if any, else null), assigned_by (the person who gave the task, if identifiable, " +
                        "else infer as the sender who instructed the task). " +
                        "Do not include code fences or explanations, only JSON.\n\n" +
                        "Conversation:\n%s",
                currentDate, currentTime, currentIsoDateTime, clientZone.toString(),
                utcIsoDateTime, clientZone.toString(), conversation.toString()
        );

        // Enhanced system message with timezone context
        String systemMessage = String.format(
                "You are a task extraction assistant. The user's current local date/time is %s at %s (timezone: %s). " +
                        "When interpreting relative dates in conversations, use the user's local date/time as reference. " +
                        "Always respond with ONLY a raw JSON object containing task_title, deadline, assignee, and assigned_by. " +
                        "Convert relative time references to absolute ISO 8601 datetime format WITH the user's timezone offset. " +
                        "Example: if user says 'tomorrow 2pm' and their timezone is +05:30, return '2025-09-12T14:00:00+05:30'.",
                currentDate, currentTime, clientZone.toString()
        );

        Map<String, Object> body = Map.of(
                "model", "llama-3.3-70b-versatile",
                "messages", List.of(
                        Map.of("role", "system", "content", systemMessage),
                        Map.of("role", "user", "content", prompt)
                ),
                "temperature", 0.2,
                "max_tokens", 300
        );

        return webClient.post()
                .uri("https://api.groq.com/openai/v1/chat/completions")
                .header("Authorization", "Bearer " + groqApiKey)
                .header("Content-Type", "application/json")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(LLMResponseDTO.class)
                .flatMap(resp -> {
                    String responseText = resp.getChoices().stream()
                            .findFirst()
                            .map(choice -> choice.getMessage().getContent())
                            .orElse("{}");

                    // Clean up (remove ```json ... ``` if present)
                    String cleaned = responseText
                            .replaceAll("(?s)```json", "")
                            .replaceAll("(?s)```", "")
                            .trim();

                    try {
                        ObjectMapper mapper = new ObjectMapper();
                        Map<String, Object> taskData = mapper.readValue(cleaned, new TypeReference<>() {});

                        // Parse deadline and convert to UTC for storage
                        Instant deadlineUtc = null;
                        if (taskData.get("deadline") != null &&
                                !taskData.get("deadline").toString().isBlank()) {
                            String deadlineStr = taskData.get("deadline").toString();
                            try {
                                // Parse the deadline from LLM (should be in client's timezone)
                                ZonedDateTime clientDeadline;

                                if (deadlineStr.contains("+") || deadlineStr.contains("Z") || deadlineStr.contains("-")) {
                                    // Already has timezone information
                                    clientDeadline = ZonedDateTime.parse(deadlineStr);
                                } else {
                                    // No timezone info, assume client's timezone
                                    LocalDateTime localDeadline = LocalDateTime.parse(deadlineStr);
                                    clientDeadline = localDeadline.atZone(clientZone);
                                }

                                // Convert to UTC for storage
                                deadlineUtc = clientDeadline.toInstant();

                                log.info("Parsed deadline - Client time: {}, UTC: {}",
                                        clientDeadline, deadlineUtc);

                            } catch (Exception e) {
                                log.error("Failed to parse deadline: {}", deadlineStr, e);
                                deadlineUtc = null;
                            }
                        }

                        // Handle assignedBy with fallback
                        String assignedBy = (String) taskData.get("assigned_by");
                        if (assignedBy == null || assignedBy.isBlank()) {
                            for (Map<String, String> msg : textList) {
                                String content = msg.get("content");
                                if (content != null && (
                                        content.toLowerCase().contains("finish") ||
                                                content.toLowerCase().contains("complete") ||
                                                content.toLowerCase().contains("do") ||
                                                content.toLowerCase().contains("by "))) {
                                    assignedBy = msg.getOrDefault("sender", "Unknown");
                                    break;
                                }
                            }
                            if (assignedBy == null) {
                                assignedBy = "Unknown";
                            }
                        }

                        // Create task with UTC times
                        Task task = Task.builder()
                                .taskTitle((String) taskData.getOrDefault("task_title", "Untitled Task"))
                                .deadline(deadlineUtc) // Stored in UTC
                                .assignee((String) taskData.get("assignee"))
                                .assignedBy(assignedBy)
                                .status(Task.Status.PENDING)
                                // createdAt will be set by @CreatedDate annotation in UTC
                                .build();

                        return taskRepository.save(task)
                                .flatMap(saved -> {
                                    taskSchedulerService.scheduleTaskNotification(saved);
                                    return Mono.just(ResponseEntity.ok(saved));
                                });

                    } catch (Exception e) {
                        log.error("Failed to parse task extraction response: {}", cleaned, e);
                        return Mono.just(ResponseEntity.status(500).build());
                    }
                });
    }

    @PostMapping("/chat")
    public Mono<ResponseEntity<Map<String, String>>> callLLM(@RequestBody Map<String, String> request) {
        String prompt = request.get("query");
        if (prompt == null || prompt.isBlank()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("response", "Prompt is required")));
        }

        Map<String, Object> body = Map.of(
                "model", "llama-3.3-70b-versatile",
                "messages", List.of(
                        Map.of(
                                "role", "system",
                                "content", "You are a helpful AI assistant. Provide concise, accurate answers in plain text. Do NOT use Markdown formatting, bold, italics, or lists."
                        ),
                        Map.of("role", "user", "content", prompt)
                ),
                "temperature", 0.7,
                "max_tokens", 500
        );


        return webClient.post()
                .uri("https://api.groq.com/openai/v1/chat/completions")
                .header("Authorization", "Bearer " + groqApiKey)
                .header("Content-Type", "application/json")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(LLMResponseDTO.class)
                .map(resp -> {
                    String responseText = resp.getChoices().stream()
                            .findFirst()
                            .map(choice -> choice.getMessage().getContent())
                            .orElse("");
                    return ResponseEntity.ok(Map.of("response", responseText));
                });
    }

    @PostMapping("/summarize")
    public Mono<ResponseEntity<Map<String, String>>> summarize(@RequestBody Map<String, List<Map<String, String>>> request) {
        List<Map<String, String>> textList = request.get("text");

        if (textList == null || textList.isEmpty()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("summary", "Text input is required")));
        }

        // Build conversation string from sender + content
        StringBuilder conversation = new StringBuilder();
        for (Map<String, String> msg : textList) {
            String sender = msg.getOrDefault("sender", "Unknown");
            String content = msg.getOrDefault("content", "");
            conversation.append(sender).append(": ").append(content).append("\n");
        }

        String summarizationPrompt = "Summarize the following conversation into a concise summary:\n\n"
                + conversation;

        Map<String, Object> body = Map.of(
                "model", "llama-3.3-70b-versatile",
                "messages", List.of(
                        Map.of(
                                "role", "system",
                                "content", "You are a helpful AI assistant. Summarize conversations clearly and concisely in plain text. Do not use Markdown or formatting."
                        ),
                        Map.of("role", "user", "content", summarizationPrompt)
                ),
                "temperature", 0.5,
                "max_tokens", 200
        );

        return webClient.post()
                .uri("https://api.groq.com/openai/v1/chat/completions")
                .header("Authorization", "Bearer " + groqApiKey)
                .header("Content-Type", "application/json")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(LLMResponseDTO.class)
                .map(resp -> {
                    String summary = resp.getChoices().stream()
                            .findFirst()
                            .map(choice -> choice.getMessage().getContent())
                            .orElse("");
                    return ResponseEntity.ok(Map.of("summary", summary));
                });
    }

}
