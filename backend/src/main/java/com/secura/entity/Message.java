package com.secura.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Table("messages")
public class Message {
    @Id
    private Long id;

    private String sender;
    private String recipient;
    private String content;
    private Instant timestamp;

    @Column("delivered")
    private Boolean delivered = false;
}