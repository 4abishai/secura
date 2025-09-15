package com.secura.entity;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import lombok.*;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.time.LocalDateTime;

@Document("tasks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Task {
    @Id
    private String id;

    @Field("task_title")
    private String taskTitle;

    private Instant deadline;
    private String assignee;
    private String assignedBy;
    private Status status;

    @CreatedDate
    @Field("created_at")
    private Instant createdAt;

    public enum Status {
        PENDING, DONE
    }
}
