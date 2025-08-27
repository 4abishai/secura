package com.secura.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "users")
public class User {
    @Id
    private String username;

    private String password;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String publicKey;

    private Boolean online;

    private Long lastSeen;

}