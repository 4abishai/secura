package com.secura.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class ExtractTaskRequest {
    private List<Map<String, String>> messages;
    private List<String> timezone;
}
