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
    private String id;

    @Column(unique = true)
    private String phoneNumber;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String keyBundle; // JSON string containing the Signal protocol bundle

    @Column(name = "registered_at")
    private LocalDateTime registeredAt;

}