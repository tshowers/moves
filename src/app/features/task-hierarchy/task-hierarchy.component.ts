import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Task } from '../../models/task.model';
import { ArcGaugeComponent, ArcGaugeTone } from '../../shared/arc-gauge/arc-gauge.component';

@Component( {
  selector: 'app-task-hierarchy',
  standalone: true,
  imports: [CommonModule, ArcGaugeComponent],
  templateUrl: './task-hierarchy.component.html',
  styleUrl: './task-hierarchy.component.css'
} )
export class TaskHierarchyComponent {
  @Input() tasks: Task[] = [];
  @Input() statusOnly = false;

  @Output() selectAction = new EventEmitter<Task>();
  @Output() editAction = new EventEmitter<Task>();
  @Output() completeAction = new EventEmitter<Task>();

  expandedParents = new Set<string>();

  get rootTasks (): Task[] {
    return [...this.tasks]
      .filter( task => !task.parentTaskId )
      .sort( ( a, b ) => ( a.title || '' ).localeCompare( b.title || '', undefined, { sensitivity: 'base' } ) );
  }

  getChildTasks ( parentId: string ): Task[] {
    return this.tasks
      .filter( task => String( task.parentTaskId || '' ) === String( parentId ) )
      .sort( ( a, b ) => ( a.title || '' ).localeCompare( b.title || '', undefined, { sensitivity: 'base' } ) );
  }

  progressFor ( task: Task ): number {
    if ( task.progress !== undefined && task.progress !== null ) return Math.max( 0, Math.min( 100, Number( task.progress ) || 0 ) );
    const children = this.getChildTasks( String( task.id || '' ) );
    if ( !children.length ) return task.isCompleted ? 100 : 0;
    return Math.round( children.reduce( ( total, child ) => total + this.progressFor( child ), 0 ) / children.length );
  }

  gaugeTone ( task: Task ): ArcGaugeTone {
    const progress = this.progressFor( task );
    if ( progress >= 100 ) return 'positive';
    if ( task.priority === 'High' ) return 'warn';
    return progress > 0 ? 'info' : 'attention';
  }

  displayStatus ( task: Task ): string {
    const status = String( task.status || '' ).trim().toLowerCase();
    if ( task.isCompleted || status === 'completed' ) return 'completed';
    return String( task.status || 'not-started' );
  }

  childCount ( task: Task ): number {
    return this.getChildTasks( String( task.id || '' ) ).length;
  }

  hasChildren ( task: Task ): boolean {
    return this.getChildTasks( String( task.id || '' ) ).length > 0;
  }

  // The description field is frozen at creation - it never reflects Maya's
  // day-to-day check-ins (blocked reasons, requests for a real contact,
  // completion notes). Without this, a Move that Maya re-evaluates daily
  // looks identical to one nobody has touched since it was created.
  latestNote ( task: Task ): { text: string; authorLabel: string; at: string } | null {
    const notes = Array.isArray( task.notesLog ) ? task.notesLog : [];
    if ( !notes.length ) return null;
    const latest = notes[notes.length - 1];
    if ( !latest || !latest.text ) return null;
    return {
      text: latest.text,
      authorLabel: latest.author === 'user' ? ( latest.authorLabel || 'You' ) : 'Maya',
      at: latest.at || ''
    };
  }

  isExpanded ( task: Task ): boolean {
    return this.expandedParents.has( String( task.id || '' ) );
  }

  toggleExpanded ( task: Task ): void {
    const id = String( task.id || '' );
    if ( !id ) return;

    if ( this.expandedParents.has( id ) ) {
      this.expandedParents.delete( id );
    } else {
      this.expandedParents.add( id );
    }
  }

  onSelect ( task: Task ): void {
    this.selectAction.emit( task );
  }

  onEdit ( task: Task, event?: Event ): void {
    if ( event ) event.stopPropagation();
    this.editAction.emit( task );
  }

  onComplete ( task: Task, event?: Event ): void {
    if ( event ) event.stopPropagation();
    this.completeAction.emit( task );
  }

  trackByTaskId ( _index: number, task: Task ): string {
    return String( task.id || task.title || _index );
  }
}
