import { Pipe, PipeTransform } from '@angular/core';
import { Task } from '../models/task.model';
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';

@Pipe({
  name: 'taskCountdown',
  standalone: true
})
export class TaskCountdownPipe implements PipeTransform {


  transform(task: Task): Observable<string> {
    const endDate = task.dueDate ? new Date(task.dueDate) : null;
    const timerEndTime = task.timerEndTime ? new Date(task.timerEndTime) : null;

    if (!timerEndTime && !endDate) {
      return new Observable(observer => {
        observer.next('Not Applicable');
        observer.complete();
      });
    }

    if (endDate) {
      // Add 1 day to the end date to include the full day
      endDate.setDate(endDate.getDate() + 1);
    }

    return interval(1000).pipe(
      map(() => {
        const currentTime = new Date().getTime();
        const targetTime = timerEndTime?.getTime() ?? endDate?.setHours(23, 59, 59);

        if (!targetTime || isNaN(targetTime)) {
          return 'Not Applicable';
        }

        const timeRemaining = targetTime - currentTime;

        if (timeRemaining <= 0) {
          return 'Task is overdue';
        }

        const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

        if (days > 0) {
          return `Time Remaining: ${days}d ${hours}h ${minutes}m ${seconds}s`;
        } else {
          return `Time Remaining: ${hours}h ${minutes}m ${seconds}s`;
        }
      })
    );
  }

}
