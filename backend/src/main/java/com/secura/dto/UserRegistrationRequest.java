package com.secura.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserRegistrationRequest {
    private String phoneNumber;
    private String keyBundle; // JSON string
}