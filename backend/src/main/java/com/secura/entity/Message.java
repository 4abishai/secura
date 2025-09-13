package com.secura.entity;

import org.springframework.data.annotation.Id;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

@Document("messages")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Message {
    @Id
    private String id;  // MongoDB usually uses String/ObjectId

    private String sender;
    private String recipient;
    private String content;
    private Instant timestamp;

    @Field("delivered")
    private Boolean delivered = false;
}
