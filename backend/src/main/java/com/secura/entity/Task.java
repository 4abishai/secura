package com.secura.entity;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;
import lombok.*;

import java.time.Instant;
import java.time.LocalDateTime;

@Table("tasks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Task {

    @Id
    private Long id;

    @Column("task_title")
    private String taskTitle;

    private Instant deadline;

    private String assignee;

    private String assignedBy;

    private Status status;

    @CreatedDate
    @Column("created_at")
    private Instant createdAt;

    public enum Status {
        PENDING,
        DONE
    }
}
