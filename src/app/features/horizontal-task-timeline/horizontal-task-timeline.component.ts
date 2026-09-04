import { Component, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../../models/task.model';
import { TruncatePipe } from '../../pipes/truncate.pipe';
import { TaskViewComponent } from '../task-view/task-view.component';

@Component( {
  selector: 'app-horizontal-task-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule, TruncatePipe, TaskViewComponent],
  templateUrl: './horizontal-task-timeline.component.html',
  styleUrl: './horizontal-task-timeline.component.css'
} )
export class HorizontalTaskTimelineComponent implements OnChanges {

  @Input() tasks: Task[] = []; // The tasks to be displayed
  @Output() selectAction = new EventEmitter<Task>();
  @Output() editAction = new EventEmitter<Task>();
  dates: Date[] = []; // List of dates to display as columns (starting from startDate)
  startDate: Date = new Date(); // Start from today by default

  hoveredTask: Task | null = null;
  hoverPosition = { x: 0, y: 0 };



  ngOnChanges ( changes: SimpleChanges ) {
    // Detect changes to tasks input
    if ( changes['tasks'] && changes['tasks'].currentValue ) {
      this.generateDates(); // Regenerate dates if tasks change
    }
  }

  // Generate the next 30 days starting from the selected start date
  generateDates () {
    this.dates = []; // Clear existing dates
    const startDate = new Date( this.startDate.getFullYear(), this.startDate.getMonth(), this.startDate.getDate() );

    for ( let i = 0; i < 30; i++ ) {
      const date = new Date( startDate );
      date.setDate( startDate.getDate() + i );
      this.dates.push( date );
    }

    // Filter tasks to only show those not completed and that fit within the timeline date range
    this.tasks = this.tasks
      // .filter(task => {
      //   const dueDate = new Date(task.dueDate);
      //   return !task.isCompleted;
      // })
      .sort( ( a, b ) => {
        // First, sort by due date
        const dateA = new Date( a.dueDate ).getTime();
        const dateB = new Date( b.dueDate ).getTime();
        if ( dateA !== dateB ) {
          return dateA - dateB; // Earliest due date first
        }

        // If due dates are the same, sort by priority (High > Medium > Low)
        const priorityOrder = ['High', 'Medium', 'Low'];
        const priorityA = a.priority || 'Low';
        const priorityB = b.priority || 'Low';
        return priorityOrder.indexOf( priorityA ) - priorityOrder.indexOf( priorityB );
      } );
  }

  // Check if a task is active on a particular date (from startDate to due date)
  // Helper function to compare just the date part of a Date object (ignoring the time)
  isSameOrAfter ( date1: Date, date2: Date ): boolean {
    const d1 = new Date( date1.getFullYear(), date1.getMonth(), date1.getDate() );
    const d2 = new Date( date2.getFullYear(), date2.getMonth(), date2.getDate() );
    return d1 >= d2;
  }

  isSameOrBefore ( date1: Date, date2: Date ): boolean {
    const d1 = new Date( date1.getFullYear(), date1.getMonth(), date1.getDate() );
    const d2 = new Date( date2.getFullYear(), date2.getMonth(), date2.getDate() );
    return d1 <= d2;
  }

  isTaskActive ( task: Task, date: Date ): boolean {
    const today = this.taskStartDate( task );
    const dueDate = this.parseDate( task.dueDate );
    if ( !today || !dueDate ) return false;
    dueDate.setDate( dueDate.getDate() + 1 );
    // Task is active if today is between the start date (today) and the due date
    return this.isSameOrAfter( date, today ) && this.isSameOrBefore( date, dueDate );
  }

  hasSchedule ( task: Task ): boolean {
    return !!this.parseDate( task.dueDate );
  }

  get scheduledTaskCount (): number {
    return this.visibleTasks.filter( task => this.hasSchedule( task ) ).length;
  }

  get outOfRangeTaskCount (): number {
    return this.tasks.filter( task => !this.isTaskInCalendarRange( task ) ).length;
  }

  get visibleTasks (): Task[] {
    return this.tasks
      .filter( task => this.isTaskInCalendarRange( task ) )
      .sort( ( a, b ) => {
        const dateA = this.parseDate( a.dueDate )?.getTime() || Number.MAX_SAFE_INTEGER;
        const dateB = this.parseDate( b.dueDate )?.getTime() || Number.MAX_SAFE_INTEGER;
        return dateA - dateB;
      } );
  }

  get unscheduledTaskCount (): number {
    return this.tasks.filter( task => !this.hasSchedule( task ) ).length;
  }

  private isTaskInCalendarRange ( task: Task ): boolean {
    const start = this.taskStartDate( task );
    const due = this.parseDate( task.dueDate );
    const firstDate = this.dates[0];
    const lastDate = this.dates[this.dates.length - 1];
    if ( !start || !due || !firstDate || !lastDate ) return false;

    return this.isSameOrBefore( start, lastDate ) && this.isSameOrAfter( due, firstDate );
  }

  private taskStartDate ( task: Task ): Date | null {
    const explicitStart = this.parseDate( task.startDate );
    if ( explicitStart ) return explicitStart;

    const dueDate = this.parseDate( task.dueDate );
    if ( !dueDate ) return null;

    // Moves without an explicit start still need a visible planning runway.
    const inferredStart = new Date( dueDate );
    inferredStart.setDate( inferredStart.getDate() - 6 );
    return inferredStart;
  }

  private parseDate ( value: unknown ): Date | null {
    if ( !value ) return null;
    const date = new Date( String( value ) );
    return Number.isNaN( date.getTime() ) ? null : date;
  }

  isToday ( date: Date ): boolean {
    const today = new Date();
    return date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();
  }

  isDueDate ( task: Task, date: Date ): boolean {
    if ( !task.dueDate ) return false;
    const due = new Date( task.dueDate );
    return due.getFullYear() === date.getFullYear()
      && due.getMonth() === date.getMonth()
      && due.getDate() === date.getDate();
  }

  // Handle date picker change
  onStartDateChange ( event: any ) {
    this.startDate = new Date( `${event.target.value}T00:00:00` );
    this.generateDates(); // Regenerate the timeline dates based on the new start date
  }


  onSelect ( task: Task ): void {
    this.selectAction.emit( task );
    window.scrollTo( { top: 0, behavior: 'smooth' } );
  }

  onEdit ( task: Task, event?: Event ): void {
    if ( event ) {
      event.stopPropagation();
    }

    this.editAction.emit( task );
  }

  showTaskInfo ( task: Task, event: MouseEvent ): void {
    this.hoveredTask = task;
    // Adjust the Y position to be above the cursor
    const offsetY = 40; // Adjust this value to position the box above the cursor
    const offsetX = 10; // Adjust this value for horizontal offset
    this.hoverPosition = {
      x: event.clientX + offsetX,
      y: event.clientY - offsetY
    };
  }

  /**
   * Hides the contact information by setting the hovered contact to null.
   */
  hideTaskInfo (): void {
    this.hoveredTask = null;
  }


}
