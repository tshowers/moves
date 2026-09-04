import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { Task } from '../../models/task.model';
import { MoveAutomationLane, MovesAutomationService } from '../../services/moves-automation.service';

export type MovesAutomationLaneKey = 'schedule' | 'status' | 'resources' | 'suggestions';
export type MovesAutomationSettings = Record<MovesAutomationLaneKey, boolean>;

export interface TaskDashboardStat {
  label: string;
  value: string;
  tone?: 'default' | 'good' | 'warn' | 'danger';
}

interface DashboardProgressMetric {
  label: string;
  value: string;
  progress: number;
}

interface DashboardQueueItem {
  count: string;
  title: string;
  description: string;
  tone?: 'default' | 'good' | 'warn' | 'danger';
}

@Component( {
  selector: 'app-task-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-dashboard.component.html',
  styleUrl: './task-dashboard.component.css'
} )
export class TaskDashboardComponent implements OnChanges {
  private readonly movesAutomationService = inject( MovesAutomationService );

  @Input() showHero = true;
  @Input() title = 'Moves Dashboard';
  @Input() eyebrow = 'MOVES DASHBOARD';
  @Input() tasks: Task[] = [];
  @Input() highlightedTask: Task | null = null;
  @Input() emptyTitle = 'No active moves yet';
  @Input() emptyMessage = 'Create a move to start building momentum.';
  @Input() automationBusy = false;
  @Input() automationSettings: MovesAutomationSettings = {
    schedule: true,
    status: true,
    resources: true,
    suggestions: true
  };
  @Output() applyAutomation = new EventEmitter<'schedule' | 'status' | 'suggestions'>();
  @Output() reviewAutomation = new EventEmitter<'resources'>();
  @Output() automationSettingChange = new EventEmitter<{ lane: MovesAutomationLaneKey; enabled: boolean; }>();

  automationLanes: MoveAutomationLane[] = [];
  automationTotal = 0;
  momentumPercent = 0;
  featuredTask: Task | null = null;
  stats: TaskDashboardStat[] = [];
  topFocus = 'No moves selected';
  focusDescription = this.emptyMessage;
  progressRows: Array<{ label: string; progress: number; }> = [];
  metricCards: Array<{ label: string; value: string; detail: string; }> = [];
  progressMetrics: DashboardProgressMetric[] = [];
  queueItems: DashboardQueueItem[] = [];
  commandFacts: Array<{ label: string; value: string; }> = [];
  featuredProgress = 0;

  ngOnChanges ( _changes: SimpleChanges ): void {
    this.rebuildDashboardViewModel();
  }

  trackByLabel ( _index: number, item: TaskDashboardStat ): string {
    return item.label;
  }

  trackByProgressLabel ( _index: number, item: { label: string; progress: number; } ): string {
    return item.label;
  }

  trackByQueueTitle ( _index: number, item: DashboardQueueItem ): string {
    return item.title;
  }

  trackByAutomationKey ( _index: number, item: MoveAutomationLane ): string {
    return item.key;
  }

  onApplyAutomation ( laneKey: 'schedule' | 'status' | 'suggestions' ): void {
    if ( this.automationBusy ) return;
    this.applyAutomation.emit( laneKey );
  }

  onReviewAutomation ( laneKey: 'resources' ): void {
    if ( this.automationBusy ) return;
    this.reviewAutomation.emit( laneKey );
  }

  onAutomationSettingChange ( lane: MovesAutomationLaneKey, enabled: boolean ): void {
    this.automationSettingChange.emit( { lane, enabled } );
  }

  private rebuildDashboardViewModel (): void {
    const now = Date.now();
    const activeTasks = this.tasks.filter( task => !task.isCompleted );
    const completedTasks = this.tasks.filter( task => !!task.isCompleted );
    const dueToday = activeTasks.filter( task => this.isDueToday( task, now ) ).length;
    const overdue = activeTasks.filter( task => this.isOverdue( task, now ) ).length;
    const completed = completedTasks.length;
    const total = this.tasks.length || 1;
    const healthyCount = activeTasks.filter( task => !this.isOverdue( task, now ) ).length;
    const attentionCount = activeTasks.filter( task => this.isOverdue( task, now ) || task.needsAttention ).length;
    const readyToClose = activeTasks.filter( task => this.normalizeProgress( task.progress ) >= 80 ).length;

    this.automationLanes = this.movesAutomationService.buildAutomationLanes( this.tasks )
      .map( lane => this.automationSettings[lane.key]
        ? lane
        : {
          ...lane,
          detail: 'Automation is paused for this lane.',
          nextAction: 'Enable the lane when you want TODD to watch this area again.',
          tone: 'default' as const
        } );
    this.automationTotal = this.automationLanes.reduce( ( sum, lane ) => sum + ( this.automationSettings[lane.key] ? lane.count : 0 ), 0 );

    this.momentumPercent = this.tasks.length
      ? Math.round( this.tasks.reduce( ( sum, task ) => sum + this.normalizeProgress( task.progress ), 0 ) / this.tasks.length )
      : 0;

    this.featuredTask = this.highlightedTask || this.resolveFeaturedTask();
    this.featuredProgress = this.normalizeProgress( this.featuredTask?.progress );
    this.topFocus = this.featuredTask?.title || 'No moves selected';
    this.focusDescription = this.featuredTask
      ? `${this.featuredTask.status || 'Not started'} · ${this.featuredTask.dueDate ? this.formatShortDate( this.featuredTask.dueDate ) : 'No due date'}`
      : this.emptyMessage;

    this.progressRows = this.tasks.slice( 0, 3 ).map( task => ( {
      label: task.title || 'Untitled move',
      progress: this.normalizeProgress( task.progress )
    } ) );

    this.stats = [
      {
        label: 'Active moves',
        value: String( activeTasks.length ),
        tone: activeTasks.length ? 'default' : 'warn'
      },
      {
        label: 'Due today',
        value: String( dueToday ),
        tone: dueToday ? 'warn' : 'good'
      },
      {
        label: 'Overdue',
        value: String( overdue ),
        tone: overdue ? 'danger' : 'good'
      },
      {
        label: 'Completed',
        value: String( completed ),
        tone: completed ? 'good' : 'default'
      }
    ];

    this.metricCards = [
      {
        label: 'Active moves',
        value: String( activeTasks.length ),
        detail: 'currently in motion'
      },
      {
        label: 'Due today',
        value: String( dueToday ),
        detail: 'need same-day attention'
      },
      {
        label: 'Overdue',
        value: String( overdue ),
        detail: 'need recovery'
      },
      {
        label: 'Completed',
        value: String( completed ),
        detail: 'closed out'
      }
    ];

    this.progressMetrics = [
      {
        label: 'Momentum',
        value: `${this.momentumPercent}%`,
        progress: this.momentumPercent
      },
      {
        label: 'Completion',
        value: `${Math.round( ( completed / total ) * 100 )}%`,
        progress: Math.round( ( completed / total ) * 100 )
      },
      {
        label: 'Needs attention',
        value: String( attentionCount ),
        progress: Math.min( 100, Math.round( ( attentionCount / total ) * 100 ) )
      },
      {
        label: 'On track',
        value: String( healthyCount ),
        progress: Math.min( 100, Math.round( ( healthyCount / total ) * 100 ) )
      }
    ];

    this.queueItems = [
      {
        count: String( attentionCount ),
        title: 'Follow-up required',
        description: 'Moves that need attention so momentum does not stall.',
        tone: attentionCount ? 'warn' : 'good'
      },
      {
        count: String( dueToday ),
        title: 'Due today',
        description: 'Work landing today that needs a clean finish.',
        tone: dueToday ? 'warn' : 'good'
      },
      {
        count: String( readyToClose ),
        title: 'Ready to close',
        description: 'Moves already close to done and ready to push across the line.',
        tone: readyToClose ? 'good' : 'default'
      }
    ];

    this.commandFacts = this.featuredTask
      ? [
        { label: 'Status', value: this.featuredTask.status || 'Not started' },
        { label: 'Priority', value: this.featuredTask.priority || 'Standard' },
        { label: 'Due date', value: this.featuredTask.dueDate ? this.formatShortDate( this.featuredTask.dueDate ) : 'No due date' },
        { label: 'Progress', value: `${this.featuredProgress}%` }
      ]
      : [
        { label: 'Status', value: 'No move selected' },
        { label: 'Priority', value: 'Standard' },
        { label: 'Due date', value: 'No due date' },
        { label: 'Progress', value: '0%' }
      ];
  }

  private resolveFeaturedTask (): Task | null {
    if ( !this.tasks.length ) return null;

    const prioritized = [ ...this.tasks ].sort( ( a, b ) => {
      const aProgress = a.progress ?? 0;
      const bProgress = b.progress ?? 0;
      return bProgress - aProgress;
    } );

    return prioritized[0] || null;
  }

  private normalizeProgress ( value: number | undefined ): number {
    if ( typeof value !== 'number' || Number.isNaN( value ) ) return 0;
    if ( value < 0 ) return 0;
    if ( value > 100 ) return 100;
    return value;
  }

  private isDueToday ( task: Task, now: number ): boolean {
    if ( !task.dueDate ) return false;

    const due = new Date( task.dueDate );
    if ( Number.isNaN( due.getTime() ) ) return false;

    const today = new Date( now );
    return due.getFullYear() === today.getFullYear()
      && due.getMonth() === today.getMonth()
      && due.getDate() === today.getDate();
  }

  private isOverdue ( task: Task, now: number ): boolean {
    if ( task.isCompleted || !task.dueDate ) return false;

    const due = new Date( task.dueDate );
    if ( Number.isNaN( due.getTime() ) ) return false;

    return due.getTime() < now && !this.isDueToday( task, now );
  }

  private formatShortDate ( value: string ): string {
    const date = new Date( value );
    if ( Number.isNaN( date.getTime() ) ) return value;
    return date.toLocaleDateString( undefined, { month: 'short', day: 'numeric' } );
  }
}
