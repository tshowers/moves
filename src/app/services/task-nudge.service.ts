import { Injectable } from '@angular/core';
import { Task } from '../models/task.model';
import dayjs from 'dayjs';
import { LoggerService } from './logger.service';
import { TaskApiService } from './task-api.service';

const TASK_NUDGE_STORAGE_KEY = 'lastTaskNudge';

/**
 * Near-verbatim port of services/task-nudge.service.ts - pure client-side
 * computation over an already-fetched Task[], no HTTP of its own beyond
 * the TaskApiService.updateTask() call it already made. Only rename is
 * TaskService -> TaskApiService.
 */
@Injectable({
  providedIn: 'root'
})
export class TaskNudgeService {

  constructor(private logger: LoggerService, private taskService: TaskApiService) {}

  /**
   * Checks tasks associated with a given user to see if any require attention due to being overdue, stalling, or floating without a due date.
   * If there are tasks needing attention and the user has not been nudged in the last 24 hours, a nudge is stored.
   * This method may also automatically set the status of long-overdue tasks to 'stale' or 'archived' so they no longer clutter the active task list.
   */
  async checkForTaskNudges(userId: string, tasks: Task[]): Promise<Task[]> {
    const lastNudge = localStorage.getItem(TASK_NUDGE_STORAGE_KEY);

    if (lastNudge) {
      const lastNudgeDate = dayjs(lastNudge);
      const now = dayjs();
      if (now.diff(lastNudgeDate, 'hour') < 24) {
        this.logger.info("ALREADY CHECKED TASKS");
        return [];
      }
    }

    this.logger.info("CHECKING TASKS", tasks);

    const now = dayjs();

    const tasksNeedingAttention = tasks.filter(task => {
      const isActive = !task.status || task.status.toLowerCase() === 'active' || task.status.toLowerCase() === 'todo';
      const isCompleted = task.isCompleted || (task.progress || 0) >= 100;
      const hasDueDate = !!task.dueDate;
      const nowInner = dayjs();

      const isOverdue = hasDueDate && dayjs(task.dueDate).isBefore(nowInner) && !isCompleted;
      const isStalling = hasDueDate && dayjs(task.dueDate).diff(nowInner, 'day') <= 2 && (task.progress || 0) < 50;
      const isFloating = !hasDueDate && !isCompleted;

      return isActive && (isOverdue || isStalling || isFloating);
    });

    // Auto-update status for long-ignored tasks so they drop out of the main view
    const STALE_DAYS = 7;    // overdue more than a week => stale
    const ARCHIVE_DAYS = 30; // overdue more than a month => archived

    tasksNeedingAttention.forEach(task => {
      if (!task.dueDate) {
        return; // floating/no-due-date tasks just get nudged, not auto-status-changed
      }

      const due = dayjs(task.dueDate);
      const daysOverdue = now.diff(due, 'day');

      // Only touch tasks that are actually overdue
      if (daysOverdue <= 0) return;

      // Decide new status based on how stale they are
      let newStatus: string | null = null;
      if (daysOverdue >= ARCHIVE_DAYS) {
        newStatus = 'archived';
      } else if (daysOverdue >= STALE_DAYS) {
        newStatus = 'stale';
      }

      if (newStatus && task.status !== newStatus) {
        const originalStatus = task.status;
        task.status = newStatus;
        this.logger.info('TASK_STATUS_AUTO_UPDATE', {
          taskId: task.id,
          from: originalStatus,
          to: newStatus,
          daysOverdue
        });
        this.taskService.updateTask(task.id, task as Task, userId).catch(err => {
          this.logger.error('Failed to auto-update task status', { taskId: task.id, error: err });
        });
      }
    });

    if (tasksNeedingAttention.length > 0) {
      localStorage.setItem(TASK_NUDGE_STORAGE_KEY, new Date().toISOString());
    }

    return tasksNeedingAttention;
  }

  /**
   * Resets the task nudge flag by removing it from the local storage.
   */
  resetNudgeFlag() {
    localStorage.removeItem(TASK_NUDGE_STORAGE_KEY);
  }

}
