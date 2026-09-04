import { Component, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task, TaskType } from '../../models/task.model';
import { LoggerService } from '../../services/logger.service';
import { TruncatePipe } from '../../pipes/truncate.pipe';
import { TaskCountdownPipe } from '../../pipes/task-countdown.pipe';


@Component( {
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule, TruncatePipe, TaskCountdownPipe],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.css'
} )
export class TimelineComponent implements OnChanges {

  @Input() tasks: Task[] = [];
  @Input() taskTypes!: TaskType[] | null;
  filteredAndSortedTasks: Task[] = [];
  @Output() editAction = new EventEmitter<Task>();

  constructor ( private logger: LoggerService ) { }

  ngOnChanges ( changes: SimpleChanges ) {
    if ( changes['tasks'] ) {
      this.filterAndSortTasks();
    }
  }

  public updateTimeLine ( tasks: Task[] ): void {
    this.tasks = tasks;
    this.filterAndSortTasks();
  }

  filterAndSortTasks () {
    // Filter out completed tasks and sort tasks by due date in ascending order
    this.filteredAndSortedTasks = this.tasks
      .filter( task => !task.isCompleted && task.dueDate )
      .sort( ( a, b ) => new Date( a.dueDate! ).getTime() - new Date( b.dueDate! ).getTime() );
    this.logger.info( "Sorted Tasks", this.filteredAndSortedTasks );
  }

  editTask ( task: Task ): void {
    this.editAction.emit( task );
  }

}
