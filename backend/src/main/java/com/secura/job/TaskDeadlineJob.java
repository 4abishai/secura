package com.secura.job;

import com.secura.repository.TaskRepository;
import com.secura.service.TaskNotificationService;
import lombok.extern.slf4j.Slf4j;
import org.quartz.Job;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;
import org.springframework.beans.factory.annotation.Autowired;
import reactor.core.publisher.Mono;

@Slf4j
public class TaskDeadlineJob implements Job {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TaskNotificationService notificationService;

    @Override
    public void execute(JobExecutionContext context) {
        JobDataMap dataMap = context.getJobDetail().getJobDataMap();
        if (!dataMap.containsKey("taskId")) {
            log.error("No taskId found in JobDataMap");
            return;
        }

        String taskId = dataMap.getString("taskId");

        taskRepository.findById(taskId)
                .doOnNext(task -> {
                    log.info("Triggering deadline notification for task {}", taskId);
                    notificationService.sendDeadlineNotification(task);
                })
                .switchIfEmpty(Mono.fromRunnable(() ->
                        log.warn("Task {} not found when deadline job triggered", taskId)
                ))
                .doOnError(error -> log.error("Error executing deadline job for task {}", taskId, error))
                .subscribe();
    }
}
