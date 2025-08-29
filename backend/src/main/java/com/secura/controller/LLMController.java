package com.secura.controller;

import com.secura.dto.LLMResponseDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

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
