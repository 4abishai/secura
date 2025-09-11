package com.secura.repository;

import com.secura.entity.Task;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import reactor.core.publisher.Flux;

import java.time.Instant;

public interface TaskRepository extends R2dbcRepository<Task, Long> {

    @Query("SELECT * FROM tasks WHERE deadline BETWEEN :startTime AND :endTime AND status = 'PENDING'")
    Flux<Task> findTasksWithDeadlineBetween(Instant startTime, Instant endTime);

    @Query("SELECT * FROM tasks WHERE assignee = :assignee AND status = 'PENDING'")
    Flux<Task> findPendingTasksByAssignee(String assignee);
}
