import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task, TaskType } from '../../models/task.model';
import { Contact } from '../../models/contact.model';
import { AppendYouPipe } from '../../pipes/append-you.pipe';

import { LoggerService } from '../../services/logger.service';

@Component( {
  selector: 'app-sub-task',
  standalone: true,
  imports: [CommonModule, FormsModule, AppendYouPipe],
  templateUrl: './sub-task.component.html',
  styleUrl: './sub-task.component.css'
} )
export class SubTaskComponent {

  @Input() parentTask!: Task;
  @Input() contacts!: Contact[] | null;
  @Input() taskTypes!: TaskType[] | null;
  @Input() userId!: string;
  @Output() subTasksCreated: EventEmitter<Task[]> = new EventEmitter<Task[]>();
  @Output() updateAction = new EventEmitter<Task>();

  newSubTaskTitle: string = '';
  newSubTasksBulk: string = '';
  subTasks: Task[] = [];
  newSubTaskDescription!: string;
  newSubTaskDueDate!: any;
  selectedContacts: string[] = [];
  selectedTaskType!: string;
  editedSubTask: Task | null = null; // The subtask being edited, if any
  newSubTask: Task = { title: '', description: '', dueDate: '', progress: 0, taskTypeId: '', contactIds: [] }; // Default new subtask structure

  constructor ( private logger: LoggerService ) { }


  getCurrentSubTask (): Task {
    return this.editedSubTask || this.newSubTask;
  }

  addSubTasksFromBulk () {
    if ( !this.parentTask ) {
      throw new Error( "Parent task is not defined" );
    }

    // Ensure subTasks is initialized as an array if it doesn't already exist

    const lines = this.newSubTasksBulk.split( '\n' ).filter( line => line.trim() !== '' );
    lines.forEach( line => {
      const parts = line.split( ',' );
      const title = parts[0].trim();
      const description = parts.length > 1 ? parts[1].trim() : '';
      const subTask: Task = {
        id: this.generateTaskId(),
        title: title,
        description: description,
        dueDate: this.parentTask.dueDate,
        progress: 0,
        isCompleted: false,
        subTasks: [],
        taskTypeId: '',
        contactIds: [],
        parentTaskId: this.parentTask.id
      };
      if ( !this.parentTask.subTasks ) {
        this.parentTask.subTasks = [];
      }
      this.parentTask.subTasks.push( subTask );
    } );
    this.newSubTasksBulk = '';
    this.onSubTaskAddOrUpdate();
    this.logger.info( "New Sub Tasks", lines );
  }

  addOrEditSubTask () {
    if ( this.editedSubTask ) {

      const index = this.parentTask?.subTasks?.findIndex( st => st.id === this.editedSubTask?.id );
      if ( index !== undefined && index > -1 && this.parentTask?.subTasks ) {
        this.parentTask.subTasks[index] = { ...this.editedSubTask }; // Update the subtask in the list
        this.editedSubTask = null; // Clear the editing state
        this.newSubTask = { title: '', description: '', dueDate: '', progress: 0, taskTypeId: '', contactIds: [] }; // Reset the form
        this.onSubTaskAddOrUpdate();
      }
    } else {
      if ( this.parentTask?.subTasks ) {
        const newSubTask: Task = { ...this.newSubTask, id: this.generateTaskId() }; // Assign a temporary client ID to the new subtask
        this.parentTask.subTasks.push( newSubTask ); // Add the new subtask to the list
        this.newSubTask = { title: '', description: '', dueDate: '', progress: 0, taskTypeId: '', contactIds: [] }; // Reset the form
        this.onSubTaskAddOrUpdate();
      }
    }
  }
  generateTaskId (): string {
    return `tmp-${Date.now()}-${Math.random().toString( 36 ).slice( 2, 8 )}`;
  }

  // Method to initiate subtask editing
  editSubTask ( subTask: Task ) {
    this.editedSubTask = { ...subTask }; // Clone the subtask for editing
  }

  // Method to delete a subtask
  deleteSubTask ( subTask: Task ) {
    if ( this.parentTask?.subTasks ) {
      this.parentTask.subTasks = this.parentTask.subTasks.filter( st => st.id !== subTask.id );
      this.cancelEdit();
    }
  }

  // Method to reset the form or cancel the edit
  cancelEdit () {
    this.editedSubTask = null; // Cancel editing
  }

  onSubTaskAddOrUpdate (): void {
    if ( this.parentTask && this.parentTask.id )
      this.updateAction.emit( this.parentTask );

  }


}
