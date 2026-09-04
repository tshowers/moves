import { Injectable } from '@angular/core';
import { Task } from '../models/task.model';

export interface MoveAutomationLane {
  key: 'schedule' | 'status' | 'resources' | 'suggestions';
  label: string;
  count: number;
  detail: string;
  nextAction: string;
  tone: 'default' | 'good' | 'warn';
}

export interface MoveAutomationPatch {
  taskId: string;
  changes: Partial<Task>;
  reason: string;
}

export interface SuggestedMoveDraft {
  task: Task;
  reason: string;
}

export interface MoveResourceRecommendation {
  taskId: string;
  taskTitle: string;
  missing: Array<'contact' | 'project' | 'documents' | 'description'>;
  summary: string;
}

@Injectable( {
  providedIn: 'root'
} )
export class MovesAutomationService {
  buildAutomationLanes ( tasks: Task[] ): MoveAutomationLane[] {
    const activeTasks = tasks.filter( task => this.isActiveTask( task ) );
    const scheduleCandidates = this.findScheduleAdjustmentCandidates( activeTasks );
    const statusCandidates = this.findStatusAdjustmentCandidates( activeTasks );
    const resourceCandidates = this.findResourceAdjustmentCandidates( activeTasks );
    const suggestedMoveCandidates = this.findSuggestedMoveCandidates( tasks );

    return [
      {
        key: 'schedule',
        label: 'Schedule adjustments',
        count: scheduleCandidates.length,
        detail: scheduleCandidates.length
          ? 'Moves with due dates missing, slipping, or landing too soon for the current progress.'
          : 'Dates look healthy right now.',
        nextAction: scheduleCandidates.length
          ? `Next: ${scheduleCandidates[0].title || 'Untitled move'}`
          : 'No schedule shifts needed.',
        tone: scheduleCandidates.length ? 'warn' : 'good'
      },
      {
        key: 'status',
        label: 'Status adjustments',
        count: statusCandidates.length,
        detail: statusCandidates.length
          ? 'Moves whose status no longer matches the progress or completion signal.'
          : 'Statuses are aligned with the work.',
        nextAction: statusCandidates.length
          ? `Next: ${statusCandidates[0].title || 'Untitled move'}`
          : 'No status cleanup needed.',
        tone: statusCandidates.length ? 'warn' : 'good'
      },
      {
        key: 'resources',
        label: 'Resource adjustments',
        count: resourceCandidates.length,
        detail: resourceCandidates.length
          ? 'Moves missing a contact, project, or supporting asset that would help TODD move the work.'
          : 'Moves already have useful context.',
        nextAction: resourceCandidates.length
          ? this.getResourceRecommendation( resourceCandidates[0] ).summary
          : 'No resource gaps detected.',
        tone: resourceCandidates.length ? 'warn' : 'good'
      },
      {
        key: 'suggestions',
        label: 'Suggested moves',
        count: suggestedMoveCandidates.length,
        detail: suggestedMoveCandidates.length
          ? 'TODD sees follow-up work that should probably exist as a new move.'
          : 'No new move suggestions right now.',
        nextAction: suggestedMoveCandidates.length
          ? suggestedMoveCandidates[0]
          : 'TODD is standing by for the next signal.',
        tone: suggestedMoveCandidates.length ? 'default' : 'good'
      }
    ];
  }

  findScheduleAdjustmentCandidates ( tasks: Task[] ): Task[] {
    return tasks.filter( task => this.needsScheduleAdjustment( task ) );
  }

  findStatusAdjustmentCandidates ( tasks: Task[] ): Task[] {
    return tasks.filter( task => this.needsStatusAdjustment( task ) );
  }

  findResourceAdjustmentCandidates ( tasks: Task[] ): Task[] {
    return tasks
      .filter( task => this.needsResourceAdjustment( task ) )
      .sort( ( a, b ) => this.getMissingResourceKeys( b ).length - this.getMissingResourceKeys( a ).length );
  }

  getResourceRecommendation ( task: Task ): MoveResourceRecommendation {
    const missing = this.getMissingResourceKeys( task );
    const summary = missing.length
      ? `Next: ${task.title || 'Untitled move'} needs ${this.formatMissingResourceSummary( missing )}.`
      : `${task.title || 'Untitled move'} already has the core context TODD needs.`;

    return {
      taskId: String( task.id || '' ),
      taskTitle: task.title || 'Untitled move',
      missing,
      summary
    };
  }

  buildScheduleAdjustmentPatches ( tasks: Task[] ): MoveAutomationPatch[] {
    const now = new Date();

    return this.findScheduleAdjustmentCandidates( tasks )
      .filter( task => !!task.id )
      .map( task => {
        const baseDate = this.parseDate( task.dueDate ) || now;
        let nextDate = new Date( baseDate );
        let reason = 'TODD adjusted the move schedule to better match current progress.';

        if ( !task.dueDate ) {
          nextDate = new Date( now );
          nextDate.setDate( now.getDate() + 3 );
          reason = 'TODD added a due date because this move was active without one.';
        } else if ( this.isOverdue( task ) ) {
          nextDate = new Date( now );
          nextDate.setDate( now.getDate() + 2 );
          reason = 'TODD pushed the due date forward because the move was overdue.';
        } else if ( this.isDueSoon( task ) && this.normalizeProgress( task.progress ) < 50 ) {
          nextDate = new Date( baseDate );
          nextDate.setDate( baseDate.getDate() + 3 );
          reason = 'TODD added breathing room because the move is due soon but still early in progress.';
        } else if ( ( task.extensionDays || 0 ) > 0 ) {
          nextDate = new Date( baseDate );
          nextDate.setDate( baseDate.getDate() + ( task.extensionDays || 0 ) );
          reason = 'TODD applied the requested extension days to the schedule.';
        }

        return {
          taskId: String( task.id ),
          changes: {
            dueDate: nextDate.toISOString(),
            extensionDays: 0,
            needsAttention: false
          },
          reason
        };
      } );
  }

  buildStatusAdjustmentPatches ( tasks: Task[] ): MoveAutomationPatch[] {
    return this.findStatusAdjustmentCandidates( tasks )
      .filter( task => !!task.id )
      .map( task => {
        const progress = this.normalizeProgress( task.progress );
        const currentStatus = ( task.status || 'not-started' ).toLowerCase();
        const normalizedCurrent = ( { todo: 'not-started', stale: 'on-hold', archived: 'cancelled' } as Record<string, string> )[currentStatus] ?? currentStatus;
        let nextStatus = normalizedCurrent;
        let isCompleted = !!task.isCompleted;
        let reason = 'TODD aligned the move status with the current work signal.';

        if ( progress >= 100 ) {
          nextStatus = 'completed';
          isCompleted = true;
          reason = 'TODD marked the move completed because progress is already at 100%.';
        } else if ( progress > 0 && ( currentStatus === 'todo' || currentStatus === 'not-started' ) ) {
          nextStatus = 'in-progress';
          reason = 'TODD moved the status to in-progress because work has already started.';
        } else if ( this.isOverdue( task ) ) {
          nextStatus = 'on-hold';
          reason = 'TODD put the move on hold because it is overdue and still unresolved.';
        } else if ( currentStatus === 'completed' && !task.isCompleted ) {
          nextStatus = 'in-progress';
          reason = 'TODD reopened the move because the completion signal was missing.';
        }

        return {
          taskId: String( task.id ),
          changes: {
            status: nextStatus,
            isCompleted,
            needsAttention: nextStatus === 'stale'
          },
          reason
        };
      } );
  }

  buildSuggestedMoveDrafts ( tasks: Task[] ): SuggestedMoveDraft[] {
    const existingTitles = new Set(
      tasks
        .map( task => ( task.title || '' ).trim().toLowerCase() )
        .filter( Boolean )
    );

    const drafts: SuggestedMoveDraft[] = [];
    const pushDraft = ( task: Task, reason: string ) => {
      const normalizedTitle = ( task.title || '' ).trim().toLowerCase();
      if ( !normalizedTitle || existingTitles.has( normalizedTitle ) ) {
        return;
      }

      existingTitles.add( normalizedTitle );
      drafts.push( { task, reason } );
    };

    tasks
      .filter( task =>
        !!task.isCompleted
        && ( ( task.contactIds && task.contactIds.length > 0 ) || ( task.contacts && task.contacts.length > 0 ) )
      )
      .slice( 0, 2 )
      .forEach( task => {
        const sourceTitle = task.title || 'recently completed move';
        pushDraft( {
          title: `Follow up after ${sourceTitle}`,
          description: `TODD suggested a follow-up move based on the completion of "${sourceTitle}".`,
          dueDate: this.shiftDate( new Date(), 2 ).toISOString(),
          progress: 0,
          priority: ( task.priority || 'medium' ).toLowerCase(),
          status: 'not-started',
          isCompleted: false,
          contactIds: task.contactIds || [],
          contacts: task.contacts || [],
          projectId: task.projectId || '',
          taskTypeId: task.taskTypeId || '',
          documents: [],
          images: [],
          subTasks: []
        } as Task, `Created from the completion signal on "${sourceTitle}".` );
      } );

    tasks
      .filter( task => this.isActiveTask( task ) && !task.dueDate && this.normalizeProgress( task.progress ) > 0 )
      .slice( 0, 2 )
      .forEach( task => {
        const sourceTitle = task.title || 'in-flight move';
        pushDraft( {
          title: `Set next step for ${sourceTitle}`,
          description: `TODD suggested a planning move because "${sourceTitle}" is active without a dated next step.`,
          dueDate: this.shiftDate( new Date(), 1 ).toISOString(),
          progress: 0,
          priority: 'medium',
          status: 'not-started',
          isCompleted: false,
          contactIds: task.contactIds || [],
          contacts: task.contacts || [],
          projectId: task.projectId || '',
          taskTypeId: task.taskTypeId || '',
          documents: [],
          images: [],
          subTasks: []
        } as Task, `Created because "${sourceTitle}" is moving without a dated follow-up.` );
      } );

    return drafts;
  }

  private isActiveTask ( task: Task ): boolean {
    const status = ( task.status || '' ).toLowerCase();
    return !task.isCompleted && status !== 'archived' && status !== 'stale' && status !== 'completed';
  }

  private needsScheduleAdjustment ( task: Task ): boolean {
    const progress = this.normalizeProgress( task.progress );

    if ( !task.dueDate ) {
      return true;
    }

    if ( this.isOverdue( task ) && progress < 100 ) {
      return true;
    }

    if ( this.isDueSoon( task ) && progress < 50 ) {
      return true;
    }

    return ( task.extensionDays || 0 ) > 0;
  }

  private needsStatusAdjustment ( task: Task ): boolean {
    const status = ( task.status || 'todo' ).toLowerCase();
    const progress = this.normalizeProgress( task.progress );

    if ( progress >= 100 && status !== 'completed' && !task.isCompleted ) {
      return true;
    }

    if ( progress > 0 && ( status === 'todo' || status === 'not-started' ) ) {
      return true;
    }

    if ( this.isOverdue( task ) && ( status === 'todo' || status === 'active' || status === 'in-progress' ) ) {
      return true;
    }

    return status === 'completed' && !task.isCompleted;
  }

  private needsResourceAdjustment ( task: Task ): boolean {
    return this.getMissingResourceKeys( task ).length > 0;
  }

  private findSuggestedMoveCandidates ( tasks: Task[] ): string[] {
    const suggestions: string[] = [];
    const activeTasks = tasks.filter( task => this.isActiveTask( task ) );
    const completedTasks = tasks.filter( task => !!task.isCompleted );

    if ( activeTasks.length === 0 ) {
      suggestions.push( 'Create your next move so TODD has work to orchestrate.' );
    }

    completedTasks
      .filter( task => ( task.contactIds && task.contactIds.length > 0 ) || ( task.contacts && task.contacts.length > 0 ) )
      .slice( 0, 2 )
      .forEach( task => {
        suggestions.push( `Create a follow-up move after "${task.title || 'Untitled move'}".` );
      } );

    activeTasks
      .filter( task => !task.dueDate && this.normalizeProgress( task.progress ) > 0 )
      .slice( 0, 2 )
      .forEach( task => {
        suggestions.push( `Turn "${task.title || 'Untitled move'}" into a dated next step.` );
      } );

    return suggestions;
  }

  private isDueSoon ( task: Task ): boolean {
    if ( !task.dueDate ) return false;

    const due = new Date( task.dueDate );
    if ( Number.isNaN( due.getTime() ) ) return false;

    const now = new Date();
    const diff = due.getTime() - now.getTime();
    const days = diff / ( 1000 * 60 * 60 * 24 );
    return days >= 0 && days <= 2;
  }

  private isOverdue ( task: Task ): boolean {
    if ( !task.dueDate ) return false;

    const due = new Date( task.dueDate );
    if ( Number.isNaN( due.getTime() ) ) return false;

    return due.getTime() < Date.now();
  }

  private normalizeProgress ( value: number | undefined ): number {
    if ( typeof value !== 'number' || Number.isNaN( value ) ) return 0;
    return Math.max( 0, Math.min( 100, value ) );
  }

  private parseDate ( value: string | undefined ): Date | null {
    if ( !value ) return null;
    const parsed = new Date( value );
    return Number.isNaN( parsed.getTime() ) ? null : parsed;
  }

  private shiftDate ( value: Date, days: number ): Date {
    const next = new Date( value );
    next.setDate( next.getDate() + days );
    return next;
  }

  private getMissingResourceKeys ( task: Task ): Array<'contact' | 'project' | 'documents' | 'description'> {
    const missing: Array<'contact' | 'project' | 'documents' | 'description'> = [];
    const hasContacts = ( task.contactIds && task.contactIds.length > 0 ) || ( task.contacts && task.contacts.length > 0 );
    const hasProject = !!task.projectId;
    const hasAttachments = ( task.documents && task.documents.length > 0 ) || ( task.images && task.images.length > 0 );
    const hasDescription = !!( task.description || '' ).trim();

    if ( !hasContacts ) missing.push( 'contact' );
    if ( !hasProject ) missing.push( 'project' );
    if ( !hasAttachments ) missing.push( 'documents' );
    if ( !hasDescription ) missing.push( 'description' );

    return missing;
  }

  private formatMissingResourceSummary ( missing: Array<'contact' | 'project' | 'documents' | 'description'> ): string {
    const labels = missing.map( key => {
      switch ( key ) {
        case 'contact':
          return 'a linked contact';
        case 'project':
          return 'a linked project';
        case 'documents':
          return 'supporting documents';
        case 'description':
          return 'a clearer description';
      }
    } );

    if ( labels.length === 1 ) return labels[0];
    if ( labels.length === 2 ) return `${labels[0]} and ${labels[1]}`;
    return `${labels.slice( 0, -1 ).join( ', ')}, and ${labels[labels.length - 1]}`;
  }
}
