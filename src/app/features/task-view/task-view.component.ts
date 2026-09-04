import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../models/task.model';


@Component( {
  selector: 'app-task-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-view.component.html',
  styleUrl: './task-view.component.css'
} )
export class TaskViewComponent {

  @Input() task!: Task;
  @Input() subTasks: Task[] = [];

}
