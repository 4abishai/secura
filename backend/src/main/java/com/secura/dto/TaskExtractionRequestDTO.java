package com.secura.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskExtractionRequestDTO {
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    private static class MessageDTO {
        private String sender;
        private String receiver;
        private String content;
        private LocalDateTime timestamp;
    }

    private List<MessageDTO> messages;
}
