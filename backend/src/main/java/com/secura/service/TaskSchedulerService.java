package com.secura.service;

import com.secura.entity.Task;
import com.secura.job.TaskDeadlineJob;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.quartz.*;
import org.springframework.stereotype.Service;

import java.util.Date;

@Service
@RequiredArgsConstructor
@Slf4j
public class TaskSchedulerService {

    private final Scheduler scheduler;

    public void scheduleTaskNotification(Task task) {
        if (task.getDeadline() == null) {
            log.warn("Task {} has no deadline, skipping scheduling", task.getId());
            return;
        }

        try {
            JobDetail jobDetail = JobBuilder.newJob(TaskDeadlineJob.class)
                    .withIdentity("task-" + task.getId(), "task-deadlines")
                    .usingJobData("taskId", task.getId())
                    .build();

            Trigger trigger = TriggerBuilder.newTrigger()
                    .withIdentity("trigger-" + task.getId(), "task-deadlines")
                    .startAt(Date.from(task.getDeadline()))
                    .build();

            scheduler.scheduleJob(jobDetail, trigger);
            log.info("Scheduled deadline notification for task {} at {}", task.getId(), task.getDeadline());

        } catch (SchedulerException e) {
            log.error("Error scheduling task deadline for {}", task.getId(), e);
        }
    }

    public void cancelTaskNotification(Long taskId) {
        try {
            JobKey jobKey = new JobKey("task-" + taskId, "task-deadlines");
            scheduler.deleteJob(jobKey);
            log.info("Cancelled scheduled notification for task {}", taskId);
        } catch (SchedulerException e) {
            log.error("Error cancelling task deadline for {}", taskId, e);
        }
    }
}
