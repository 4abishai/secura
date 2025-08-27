package com.secura.dto;

import lombok.Getter;
import lombok.Setter;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponse {
    private boolean success;
    private String message;
    private String username;

    // Constructor for simple responses without user details
    public LoginResponse(boolean success, String message) {
        this.success = success;
        this.message = message;
    }
}