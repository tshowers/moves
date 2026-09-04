import { inject } from '@angular/core';

import { Component, Input, Output, OnChanges, SimpleChanges, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Task, TaskType } from '../../models/task.model';
import { FormsModule } from '@angular/forms';
import { TaskCountdownPipe } from '../../pipes/task-countdown.pipe';
import { LoggerService } from '../../services/logger.service';

type TaskChecklistItemView = {
  task: Task;
  isAiOwned: boolean;
  ownerLabel: string;
  sourceLabel: string;
  laneLabel: string;
};

@Component( {
  selector: 'app-task-checklist',
  standalone: true,
  // RouterModule added vs. the monorepo original - its template's
  // "Create Your First Move" button used a bare routerLink="/move"
  // attribute without ever importing RouterLink/RouterModule, so the
  // link was inert there too (an existing bug, not a deliberate no-op).
  // Fixed here since it's a one-line addition with no behavior change
  // beyond making the button actually navigate.
  imports: [CommonModule, FormsModule, RouterModule, TaskCountdownPipe],
  templateUrl: './task-checklist.component.html',
  styleUrl: './task-checklist.component.css'
} )
export class TaskChecklistComponent implements OnChanges {
  private readonly logger = inject( LoggerService );

  @Input() tasks: Task[] = [];
  @Input() taskTypes!: TaskType[] | null;
  @Output() editAction = new EventEmitter<Task>();
  @Output() completeAction = new EventEmitter<Task>();

  isTaskDescription: boolean = false;
  filterText: string = '';
  selectedTaskTypeId: string = '';

  groupedTasks: { [key: string]: TaskChecklistItemView[]; } = {};
  completedTasks: TaskChecklistItemView[] = [];

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes['tasks'] || changes['taskTypes'] ) {
      this.groupTasks();
    }
  }

  groupTasks (): void {
    // const taskTypeMap = ( this.taskTypes || [] ).reduce( ( map, taskType ) => {
    //   map[taskType.id] = taskType.name;
    //   return map;
    // }, {} as { [key: string]: string; } );

    this.groupedTasks = {};
    this.completedTasks = [];

    this.tasks.forEach( task => {
      const taskView = this.toTaskView( task );


      // Adjust the dueDate to account for timezone differences
      const dueDate = task.dueDate ? new Date( task.dueDate ) : null;
      if ( dueDate ) {
        dueDate.setMinutes( dueDate.getMinutes() + dueDate.getTimezoneOffset() ); // Correct the timezone offset
      }
      const dueDateString = dueDate ? dueDate.toDateString() : 'No Due Date';

      if ( task.isCompleted ) {
        this.completedTasks.push( taskView );
      } else {
        if ( !this.groupedTasks[dueDateString] ) {
          this.groupedTasks[dueDateString] = [];
        }
        this.groupedTasks[dueDateString].push( taskView );
      }
    } );

    this.applyFilter();
  }


  updateTasks ( tasks: Task[] ) {
    this.tasks = tasks;
    this.groupTasks();
  }



  filterTasks ( event: Event ): void {
    const inputElement = event.target as HTMLInputElement;
    this.filterText = inputElement.value.toLowerCase();
    this.applyFilter();
  }

  filterByTaskType ( event: Event ): void {

    const selectElement = event.target as HTMLSelectElement;
    this.selectedTaskTypeId = selectElement.value;
    if ( this.selectedTaskTypeId === "" )
      this.groupTasks();
    else
      this.applyFilter();
  }



  applyFilter (): void {
    const filteredTasks = this.filterTaskArray( this.groupedTasks );
    this.groupedTasks = filteredTasks;
    this.completedTasks = this.completedTasks.filter( item =>
      ( !this.selectedTaskTypeId || item.task.taskTypeId === this.selectedTaskTypeId ) &&
      ( item.task.title.toLowerCase().includes( this.filterText ) ||
        ( item.task.description && item.task.description.toLowerCase().includes( this.filterText ) ) )
    );
  }

  filterTaskArray ( taskArray: { [key: string]: TaskChecklistItemView[]; } ): { [key: string]: TaskChecklistItemView[]; } {
    const filteredTasks: { [key: string]: TaskChecklistItemView[]; } = {};

    Object.keys( taskArray ).forEach( dueDate => {
      const tasks = taskArray[dueDate].filter( item =>
        ( !this.selectedTaskTypeId || item.task.taskTypeId === this.selectedTaskTypeId ) &&
        ( item.task.title.toLowerCase().includes( this.filterText ) ||
          ( item.task.description && item.task.description.toLowerCase().includes( this.filterText ) ) )
      );

      if ( tasks.length > 0 ) {
        filteredTasks[dueDate] = tasks;
      }
    } );

    return filteredTasks;
  }

  toggleTaskCompletion ( task: Task ) {
    this.logger.log( '[TaskChecklist] toggleTaskCompletion. task.id:', task.id, '| task.isCompleted:', task.isCompleted );
    this.completeTask( task );
  }

  getKeys ( object: { [key: string]: TaskChecklistItemView[]; } ): string[] {
    return Object.keys( object ).sort( ( a, b ) => {
      const dateA = new Date( a ).getTime();
      const dateB = new Date( b ).getTime();
      return dateA - dateB;
    } );
  }

  editTask ( task: Task ): void {
    this.editAction.emit( task );
  }

  completeTask ( task: Task ): void {
    this.completeAction.emit( task );
  }

  private toTaskView ( task: Task ): TaskChecklistItemView {
    const ownerId = String( task.ownerId || '' ).trim().toLowerCase();
    const source = String( task.source || '' ).trim().toLowerCase();
    const isAiOwned =
      ownerId === 'maya' ||
      ownerId === 'todd' ||
      source.startsWith( 'maya-' ) ||
      source.startsWith( 'todd-' ) ||
      !!task.createdByTodd;
    const ownerLabel = ownerId === 'todd'
      ? 'TODD'
      : ownerId === 'maya'
        ? 'Maya'
        : ownerId
          ? ownerId
          : 'Operator';
    const sourceLabel = source === 'maya-daily-plan'
      ? 'Daily Plan'
      : source === 'employee-planning-task'
        ? 'Planning'
        : source === 'employee-execution-task'
          ? 'Execution'
      : source === 'maya-artifact-complete'
        ? 'Completed'
        : source === 'maya-created-move'
          ? 'Assigned'
          : source
            ? source.replace( /[-_]/g, ' ' )
            : '';
    const laneLabel = String( task.executionLane || '' ).trim()
      ? String( task.executionLane || '' ).trim().replace( /_/g, ' ' )
      : '';

    return {
      task,
      isAiOwned,
      ownerLabel,
      sourceLabel,
      laneLabel
    };
  }

}
