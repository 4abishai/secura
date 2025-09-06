package com.secura.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.secura.dto.LLMResponseDTO;
import com.secura.entity.Task;
import com.secura.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
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

    @PostMapping("/tasks/extract")
    public Mono<ResponseEntity<Task>> extractTaskFromMessages(
            @RequestBody Map<String, List<Map<String, String>>> request) {
        List<Map<String, String>> textList = request.get("messages");

        if (textList == null || textList.isEmpty()) {
            return Mono.just(ResponseEntity.badRequest().build());
        }

        // Combine the conversation
        StringBuilder conversation = new StringBuilder();
        for (Map<String, String> msg : textList) {
            String sender = msg.getOrDefault("sender", "Unknown");
            String content = msg.getOrDefault("content", "");
            conversation.append(sender).append(": ").append(content).append("\n");
        }

        // Updated prompt to include assigned_by
        String prompt = "Extract a single task from the following conversation. " +
                "Return valid JSON with keys: task_title, deadline (ISO 8601 format if possible, else null), " +
                "assignee (if any, else null), assigned_by (the person who gave the task, if identifiable, " +
                "else infer as the sender who instructed the task). " +
                "Do not include code fences or explanations, only JSON.\n" +
                "Conversation:\n" + conversation;

        Map<String, Object> body = Map.of(
                "model", "llama-3.3-70b-versatile",
                "messages", List.of(
                        Map.of(
                                "role", "system",
                                "content", "You are a task extraction assistant. Always respond with ONLY a raw JSON object containing task_title, deadline, assignee, and assigned_by."
                        ),
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

                        // Handle deadline with OffsetDateTime support
                        LocalDateTime deadline = null;
                        if (taskData.get("deadline") != null &&
                                !taskData.get("deadline").toString().isBlank()) {
                            try {
                                deadline = OffsetDateTime.parse((String) taskData.get("deadline"))
                                        .toLocalDateTime();
                            } catch (Exception ignored) {
                                // fallback if it's a plain LocalDateTime string
                                deadline = LocalDateTime.parse((String) taskData.get("deadline"));
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

                        Task task = Task.builder()
                                .taskTitle((String) taskData.getOrDefault("task_title", "Untitled Task"))
                                .deadline(deadline)
                                .assignee((String) taskData.get("assignee"))
                                .assignedBy(assignedBy)
                                .status(Task.Status.PENDING)
                                .build();

                        return taskRepository.save(task)
                                .map(saved -> ResponseEntity.ok(saved));

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
