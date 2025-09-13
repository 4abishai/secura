package com.secura.repository;

import com.secura.entity.Task;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;

import java.time.Instant;

@Repository
public interface TaskRepository extends ReactiveMongoRepository<Task, String> {

    // Find tasks between two deadlines and with status PENDING
    Flux<Task> findByDeadlineBetweenAndStatus(Instant startTime, Instant endTime, Task.Status status);

    // Find pending tasks for a specific assignee
    Flux<Task> findByAssigneeAndStatus(String assignee, Task.Status status);
}
