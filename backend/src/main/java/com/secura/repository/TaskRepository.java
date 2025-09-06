package com.secura.repository;

import com.secura.entity.Task;
import org.springframework.data.r2dbc.repository.R2dbcRepository;

public interface TaskRepository extends R2dbcRepository<Task, Long> {

}
