import { Component, OnDestroy, OnInit } from '@angular/core';
import { MovesAuthService } from '../../services/moves-auth.service';
import { MovesSettingsService } from '../../services/moves-settings.service';
import { LoggerService } from '../../services/logger.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MovesNomenclatureService } from '../../services/moves-nomenclature.service';
import { Subscription, take } from 'rxjs';
import { Task } from '../../models/task.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskApiService } from '../../services/task-api.service';
import { MovesAssistantSignalService } from '../../services/moves-assistant-signal.service';
import { MoveAutomationPatch, MoveResourceRecommendation, MovesAutomationService, SuggestedMoveDraft } from '../../services/moves-automation.service';

import { TaskChecklistComponent } from '../task-checklist/task-checklist.component';
import { TimelineComponent } from '../timeline/timeline.component';
import { HorizontalTaskTimelineComponent } from '../horizontal-task-timeline/horizontal-task-timeline.component';
import { MovesAutomationLaneKey, MovesAutomationSettings, TaskDashboardComponent } from '../task-dashboard/task-dashboard.component';

import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { TaskHierarchyComponent } from '../task-hierarchy/task-hierarchy.component';
import { RouterModule } from '@angular/router';
import { MovesNotificationService } from '../../services/moves-notification.service';
import { GoalApiService } from '../../services/goal-api.service';
import { ToddMissionRecord } from '../../models/mission.model';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';
import { CockpitCommandDeckComponent, CockpitCommandDeckLink } from '../../shared/cockpit-command-deck/cockpit-command-deck.component';

type AutomationLaneKey = 'schedule' | 'status' | 'suggestions';

type PendingAutomationItem = {
  title: string;
  detail: string;
};

type PendingAutomationReview = {
  lane: AutomationLaneKey;
  label: string;
  items: PendingAutomationItem[];
  patches?: MoveAutomationPatch[];
  drafts?: SuggestedMoveDraft[];
};

type AutomationHistoryEntry = {
  id: string;
  lane: AutomationLaneKey | 'resources';
  summary: string;
  timestamp: string;
};

type MovesWorkspaceTab = 'overview' | 'browser' | 'selected';

const MOVES_AUTOMATION_HISTORY_KEY = 'moves-automation-history';
const MOVES_AUTOMATION_SETTINGS_KEY = 'moves-automation-settings';

/**
 * Near-verbatim port of features/tasks/task-view-parent/task-view-parent.component.ts
 * (the `moves-view` route, matching this app's `/moves-view` route - the
 * legacy `tasks` route redirects here too, mirroring TODD's own routing).
 * Service renames only. Two route fixups beyond what the plan called out:
 *  - `movesCommandDeckLinks`'s 'Home' -> `/app` (same rule as task-home),
 *    'Mission Workspace' -> cross-domain todd.taliferro.tech/mission
 *    (Goal Engine isn't part of this extraction).
 *  - `bindEngagementActions()`'s 'create_move' case navigated to
 *    `/task-edit` in the monorepo, which isn't this component's own real
 *    route there either (it's `/move`) - fixed to `/move` here. This path
 *    is unreachable in this app regardless (MovesAssistantSignalService's
 *    `engagementActionRequest$` never emits), fixed for correctness
 *    rather than because it changes current behavior.
 */
@Component( {
  selector: 'app-task-view-parent',
  imports: [
    CommonModule,
    FormsModule,
    TaskChecklistComponent,
    TimelineComponent,
    HorizontalTaskTimelineComponent,
    TaskDashboardComponent,
    BackToTopComponent,
    PreloaderComponent,
    TaskHierarchyComponent,
    RouterModule,
    ClickSoundDirective,
    CockpitBrowseModeBannerComponent,
    CockpitCommandDeckComponent],
  templateUrl: './task-view-parent.component.html',
  styleUrl: './task-view-parent.component.css'
} )
export class TaskViewParentComponent implements OnInit, OnDestroy {
  private readonly isBrowser = typeof window !== 'undefined';

  private taskSubscription!: Subscription;
  private userIdSubscription!: Subscription;
  private signalSubscription!: Subscription;
  private engagementActionSubscription!: Subscription;
  toddSignalState: 'idle' | 'listening' | 'thinking' | 'ready' = 'idle';

  emptyStateTitle = 'No moves yet';
  emptyStateMessage = 'Create a move to start building momentum.';
  emptyStateCtaLabel = 'Create a Move';
  isGuestExperience = false;

  userId = '';
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  selectedTask: Task | null = null;

  currentView: 'checklist' | 'timeline' | 'calendar' | 'hierarchy' = 'checklist'; filterText = '';
  showCompleted = true;
  sortBy: 'dueDate' | 'title' | 'progress' = 'dueDate';

  errorMessage = '';
  isLoading = true;
  automationBusy = false;
  pendingAutomationReview: PendingAutomationReview | null = null;
  automationHistory: AutomationHistoryEntry[] = [];
  automationSettings: MovesAutomationSettings = {
    schedule: true,
    status: true,
    resources: true,
    suggestions: true
  };
  isShowSubTasks = false;
  projectFilterId = '';
  missionBanner: ToddMissionRecord | null = null;
  activeTab: MovesWorkspaceTab = 'overview';
  isEmbedded = false;

  readonly movesCommandDeckLinks: CockpitCommandDeckLink[] = [
    { label: 'Home', icon: 'house', routerLink: '/app' },
    { label: 'Execution Board', icon: 'table-cells-large', routerLink: '/moves-view' },
    { label: 'Create a Move', icon: 'square-plus', routerLink: '/move' },
    { label: 'Mission Workspace', icon: 'compass', action: () => window.location.assign( 'https://todd.taliferro.tech/mission' ) },
    { label: 'AI Missions', icon: 'robot', routerLink: '/ai-missions' }
  ];

  constructor ( protected authService: MovesAuthService,
    protected settingsService: MovesSettingsService,
    protected logger: LoggerService,
    protected router: Router,
    private route: ActivatedRoute,
    protected nomenclatureService: MovesNomenclatureService,
    private taskService: TaskApiService,
    private assistantBus: MovesAssistantSignalService,
    private movesAutomationService: MovesAutomationService,
    private notificationService: MovesNotificationService,
    private goalService: GoalApiService ) {

  }

  ngOnInit (): void {
    this.isEmbedded = this.route.snapshot.queryParamMap.get( 'embedded' ) === 'true';
    if ( this.isEmbedded ) {
      this.activeTab = 'browser';
      this.currentView = 'hierarchy';
    }
    this.signalSubscription = this.assistantBus.signalState$
      .subscribe( state => {
        this.toddSignalState = state;
      } );

    this.setupPage();
    this.bindEngagementActions();
    this.route.queryParamMap.subscribe( params => {
      this.projectFilterId = String( params.get( 'projectId' ) || '' ).trim();
      this.loadMissionBanner();
      this.applyFilters();
    } );
    this.loadAutomationHistory();
    this.loadAutomationSettings();

  }

  ngOnDestroy (): void {
    if ( this.taskSubscription ) this.taskSubscription.unsubscribe();
    if ( this.userIdSubscription ) this.userIdSubscription.unsubscribe();
    if ( this.signalSubscription ) this.signalSubscription.unsubscribe();
    if ( this.engagementActionSubscription ) this.engagementActionSubscription.unsubscribe();
    this.assistantBus.clearPageContext();
  }
  get hasAutomationHistory (): boolean {
    return this.automationHistory.length > 0;
  }

  get commandDeckScore (): number {
    if ( !this.filteredTasks.length ) {
      return 0;
    }

    const totalProgress = this.filteredTasks.reduce( ( sum, task ) => {
      const progress = typeof task.progress === 'number' && !Number.isNaN( task.progress ) ? task.progress : 0;
      return sum + Math.min( 100, Math.max( 0, progress ) );
    }, 0 );

    return Math.round( totalProgress / this.filteredTasks.length );
  }

  get selectedTabDisabled (): boolean {
    return !this.selectedTask;
  }

  setActiveTab ( tab: MovesWorkspaceTab ): void {
    if ( tab === 'selected' && !this.selectedTask ) {
      return;
    }

    this.activeTab = tab;
  }

  updateAutomationSetting ( event: { lane: MovesAutomationLaneKey; enabled: boolean; } ): void {
    this.automationSettings = {
      ...this.automationSettings,
      [event.lane]: event.enabled
    };

    if ( this.pendingAutomationReview?.lane === event.lane && !event.enabled ) {
      this.pendingAutomationReview = null;
    }

    if ( this.isBrowser ) {
      try {
        window.localStorage.setItem( MOVES_AUTOMATION_SETTINGS_KEY, JSON.stringify( this.automationSettings ) );
      } catch { }
    }

    this.emitAssistantActivity( 'moves_automation_setting_changed', {
      lane: event.lane,
      enabled: event.enabled
    } );
  }

  get selectedChildTasks (): Task[] {
    if ( !this.selectedTask?.id ) {
      return [];
    }

    return this.tasks
      .filter( task => String( task.parentTaskId || '' ) === String( this.selectedTask?.id ) )
      .sort( ( a, b ) => ( a.title || '' ).localeCompare( b.title || '', undefined, { sensitivity: 'base' } ) );
  }

  get selectedTaskResourceRecommendation (): MoveResourceRecommendation | null {
    if ( !this.selectedTask ) {
      return null;
    }

    const recommendation = this.movesAutomationService.getResourceRecommendation( this.selectedTask );
    return recommendation.missing.length ? recommendation : null;
  }

  private isTaskClosed ( task: Task | null | undefined ): boolean {
    if ( !task ) {
      return false;
    }

    const status = String( task.status || '' ).trim().toLowerCase();
    return !!task.isCompleted || status === 'completed' || status === 'cancelled';
  }

  private isTaskOverdue ( task: Task | null | undefined ): boolean {
    if ( !task || this.isTaskClosed( task ) ) {
      return false;
    }

    const dueTime = task.dueDate ? new Date( task.dueDate ).getTime() : Number.NaN;
    if ( Number.isNaN( dueTime ) ) {
      return false;
    }

    return dueTime < Date.now();
  }

  private isTaskStale ( task: Task | null | undefined ): boolean {
    if ( !task || this.isTaskClosed( task ) ) {
      return false;
    }

    const rawUpdatedAt = String( task.updatedAt || task.createdAt || task.startDate || '' ).trim();
    if ( !rawUpdatedAt ) {
      return false;
    }

    const updatedTime = new Date( rawUpdatedAt ).getTime();
    if ( Number.isNaN( updatedTime ) ) {
      return false;
    }

    const staleThresholdMs = 14 * 24 * 60 * 60 * 1000;
    return Date.now() - updatedTime >= staleThresholdMs;
  }

  private isTaskDisconnected ( task: Task | null | undefined ): boolean {
    if ( !task || this.isTaskClosed( task ) ) {
      return false;
    }

    const hasContacts = Array.isArray( task.contactIds ) && task.contactIds.some( Boolean )
      || Array.isArray( task.contacts ) && task.contacts.some( contact => !!contact?.id );
    const hasMissionLink = !!String( task.projectId || '' ).trim();

    return !hasContacts && !hasMissionLink;
  }

  private getFirstOverdueTask (): Task | null {
    return this.filteredTasks.find( task => this.isTaskOverdue( task ) ) || this.tasks.find( task => this.isTaskOverdue( task ) ) || null;
  }

  private getFirstStaleTask (): Task | null {
    return this.filteredTasks.find( task => this.isTaskStale( task ) ) || this.tasks.find( task => this.isTaskStale( task ) ) || null;
  }

  private getFirstDisconnectedTask (): Task | null {
    return this.filteredTasks.find( task => this.isTaskDisconnected( task ) ) || this.tasks.find( task => this.isTaskDisconnected( task ) ) || null;
  }

  private focusTaskForReview ( task: Task | null ): void {
    if ( !task ) {
      return;
    }

    this.selectedTask = task;
    this.activeTab = 'selected';
    this.publishPageContext();
    this.emitAssistantActivity( 'move_selected_for_review', {
      selectedMoveId: task?.id ? String( task.id ) : '',
      selectedMoveTitle: task?.title || ''
    } );
  }

  publishPageContext (): void {
    const overdueMoves = this.tasks.filter( task => this.isTaskOverdue( task ) );
    const staleMoves = this.tasks.filter( task => this.isTaskStale( task ) );
    const disconnectedMoves = this.tasks.filter( task => this.isTaskDisconnected( task ) );
    const missionLinkedMoves = this.tasks.filter( task => !!String( task.projectId || '' ).trim() );
    const completedMoves = this.tasks.filter( task => !!task.isCompleted );
    const activeOpenMoves = this.tasks.filter( task => !task.isCompleted && !this.isTaskOverdue( task ) );

    this.assistantBus.setPageContext( {
      feature: 'moves',
      page: 'moves-view',
      route: this.router.url,
      mode: 'list',
      title: 'Moves Browser',
      description: this.missionBanner ?
        'Browse mission-linked Moves with the current mission context visible.' :
        'Browse moves using checklist, timeline, or calendar views.',
      allowedActions: [
        'filter_moves',
        'sort_moves',
        'switch_view',
        'select_move',
        'open_move',
        'complete_move'
      ],
      selectedEntityType: 'task',
      selectedEntityId: this.selectedTask?.id ? String( this.selectedTask.id ) : '',
      summary: {
        isAuthenticated: !!this.userId && this.userId !== 'user not logged in',
        interactionMode: !!this.userId && this.userId !== 'user not logged in' ? 'member' : 'guest',
        currentView: this.currentView,
        totalMoves: this.tasks.length,
        visibleMoves: this.filteredTasks.length,
        showCompleted: this.showCompleted,
        hasFilter: !!this.filterText || !!this.projectFilterId,
        sortBy: this.sortBy,
        projectFilterId: this.projectFilterId,
        overdueMoves: overdueMoves.length,
        staleMoves: staleMoves.length,
        disconnectedMoves: disconnectedMoves.length,
        missionLinkedMoves: missionLinkedMoves.length,
        completedMoves: completedMoves.length,
        activeOpenMoves: activeOpenMoves.length,
        missionTitle: this.missionBanner?.title || '',
        missionStatus: this.missionBanner?.status || ''
      },
      dataPreview: {
        selectedTaskTitle: this.selectedTask?.title || '',
        selectedTaskStatus: this.selectedTask?.status || '',
        selectedTaskProgress: this.selectedTask?.progress ?? 0,
        selectedTaskDueDate: this.selectedTask?.dueDate || '',
        selectedTaskUpdatedAt: this.selectedTask?.updatedAt || '',
        selectedTaskHasContacts: !!( this.selectedTask?.contactIds?.length || this.selectedTask?.contacts?.length ),
        selectedTaskIsOverdue: this.isTaskOverdue( this.selectedTask ),
        selectedTaskIsStale: this.isTaskStale( this.selectedTask ),
        selectedTaskIsDisconnected: this.isTaskDisconnected( this.selectedTask ),
        projectFilterId: this.projectFilterId,
        missionTitle: this.missionBanner?.title || '',
        movesBoardRoute: '/moves-view',
        createMoveRoute: '/move',
        missionRoute: 'https://todd.taliferro.tech/mission',
        contactListRoute: '/contact-list'
      }
    } );
  }

  private emitAssistantActivity ( action: string, meta?: Record<string, any> ): void {
    this.assistantBus.emitAssistantActivity( {
      feature: 'moves',
      page: 'moves-view',
      route: this.router.url,
      mode: 'list',
      action,
      summary: {
        currentView: this.currentView,
        totalMoves: this.tasks.length,
        visibleMoves: this.filteredTasks.length,
        showCompleted: this.showCompleted,
        hasFilter: !!this.filterText || !!this.projectFilterId,
        sortBy: this.sortBy,
        projectFilterId: this.projectFilterId,
        missionTitle: this.missionBanner?.title || '',
        isGuestExperience: this.isGuestExperience,
        hasSelectedMove: !!this.selectedTask?.id
      },
      meta
    } );
  }

  private bindEngagementActions (): void {
    this.engagementActionSubscription = this.assistantBus.engagementActionRequest$.subscribe( request => {
      if ( !request || this.router.url.split( '?' )[0] !== '/moves-view' ) {
        return;
      }

      switch ( ( request as any ).action ) {
        case 'create_move':
          void this.router.navigate( ['/move'] );
          break;
        case 'clear_moves_filters':
          this.filterText = '';
          this.projectFilterId = '';
          this.applyFilters();
          this.publishPageContext();
          break;
        case 'open_mission_workspace':
          window.location.assign( 'https://todd.taliferro.tech/mission' );
          break;
        case 'review_overdue_move': {
          const overdueTask = this.getFirstOverdueTask();
          this.focusTaskForReview( overdueTask );
          if ( overdueTask ) {
            this.handleEdit( overdueTask );
          }
          break;
        }
        case 'review_stale_move': {
          const staleTask = this.getFirstStaleTask();
          this.focusTaskForReview( staleTask );
          if ( staleTask ) {
            this.handleEdit( staleTask );
          }
          break;
        }
        case 'review_disconnected_move': {
          const disconnectedTask = this.getFirstDisconnectedTask();
          this.focusTaskForReview( disconnectedTask );
          if ( disconnectedTask ) {
            this.handleEdit( disconnectedTask );
          }
          break;
        }
        case 'open_selected_move':
          if ( this.selectedTask ) {
            this.handleEdit( this.selectedTask );
          }
          break;
        default:
          break;
      }
    } );
  }

  private setFriendlyEmptyState ( options?: {
    title?: string;
    message?: string;
    ctaLabel?: string;
    guest?: boolean;
    errorMessage?: string;
  } ): void {
    this.emptyStateTitle = options?.title || 'No moves yet';
    this.emptyStateMessage = options?.message || 'Create a move to start building momentum.';
    this.emptyStateCtaLabel = options?.ctaLabel || 'Create a Move';
    this.isGuestExperience = !!options?.guest;
    this.errorMessage = options?.errorMessage || '';
  }

  openMissionWorkspace (): void {
    if ( !this.projectFilterId ) return;
    window.location.assign( `https://todd.taliferro.tech/mission?missionId=${encodeURIComponent( this.projectFilterId )}` );
  }

  setupPage (): void {
    this.isLoading = true;

    if ( this.userIdSubscription ) {
      this.userIdSubscription.unsubscribe();
    }

    this.userIdSubscription = this.authService.getUserId().subscribe( userId => {
      this.userId = userId || '';

      this.logger.info( "PULSE USER", this.userId );

      if ( !this.userId ) {
        this.tasks = [];
        this.filteredTasks = [];
        this.selectedTask = null;
        this.setFriendlyEmptyState( {
          title: 'No moves yet',
          message: 'Sign in to create moves, track progress, and keep momentum moving.',
          ctaLabel: 'Sign In to Create',
          guest: true
        } );
        this.isLoading = false;
        this.publishPageContext();
        this.emitAssistantActivity( 'moves_empty_state_viewed', {
          reason: 'guest'
        } );
        return;
      }

      if ( this.taskSubscription ) {
        this.taskSubscription.unsubscribe();
      }

      this.taskSubscription = this.taskService.loadTasks( this.userId ).subscribe( {
        next: ( tasks ) => {
          this.tasks = tasks || [];
          this.setFriendlyEmptyState( {
            title: this.projectFilterId ? 'No mission Moves yet' : 'No moves yet',
            message: this.projectFilterId ?
              'This mission does not have visible Moves yet.' :
              'Create a move to start building momentum.',
            ctaLabel: 'Create a Move',
            guest: false
          } );
          this.applyFilters();
          this.selectedTask = this.filteredTasks[0] || null;
          this.isLoading = false;
          this.publishPageContext();
          this.emitAssistantActivity( 'moves_loaded', {
            selectedMoveId: this.selectedTask?.id ? String( this.selectedTask.id ) : '',
            totalMoves: this.tasks.length,
            visibleMoves: this.filteredTasks.length
          } );
        },
        error: ( error ) => {
          this.logger.error( 'Failed to load moves', error );
          this.tasks = [];
          this.filteredTasks = [];
          this.selectedTask = null;

          const status = Number( error?.status || 0 );
          const isAuthError = status === 401 || status === 403;

          if ( isAuthError ) {
            this.setFriendlyEmptyState( {
              title: 'No moves yet',
              message: 'Sign in to create moves, track progress, and keep momentum moving.',
              ctaLabel: 'Sign In to Create',
              guest: true
            } );
          } else {
            this.setFriendlyEmptyState( {
              title: 'Moves are not available right now',
              message: 'Try again in a moment or create a new move once things settle down.',
              ctaLabel: 'Create a Move',
              guest: false,
              errorMessage: 'Unable to load moves right now.'
            } );
          }

          this.isLoading = false;
          this.publishPageContext();
          this.emitAssistantActivity( 'moves_empty_state_viewed', {
            reason: isAuthError ? 'auth_error' : 'load_error',
            status
          } );
        }
      } );
    } );
  }

  private loadMissionBanner (): void {
    if ( !this.projectFilterId ) {
      this.missionBanner = null;
      this.publishPageContext();
      return;
    }

    this.goalService.getToddMission( this.projectFilterId )
      .pipe( take( 1 ) )
      .subscribe( {
        next: ( response ) => {
          this.missionBanner = response?.data || null;
          this.publishPageContext();
        },
        error: () => {
          this.missionBanner = null;
          this.publishPageContext();
        }
      } );
  }

  setView ( view: 'checklist' | 'timeline' | 'calendar' | 'hierarchy' ): void {
    this.currentView = view;
    this.publishPageContext();
    this.emitAssistantActivity( 'moves_view_changed', {
      currentView: this.currentView
    } );
  };

  applyFilters (): void {
    const normalizedFilter = this.filterText.trim().toLowerCase();

    let next = [...this.tasks];

    if ( this.projectFilterId ) {
      next = next.filter( task => String( task.projectId || '' ) === this.projectFilterId );
    }

    if ( !this.showCompleted ) {
      next = next.filter( task => !task.isCompleted );
    }

    if ( normalizedFilter ) {
      next = next.filter( task => {
        const title = ( task.title || '' ).toLowerCase();
        const description = ( task.description || '' ).toLowerCase();
        return title.includes( normalizedFilter ) || description.includes( normalizedFilter );
      } );
    }

    next = this.sortTasks( next );
    this.filteredTasks = next;

    if ( this.selectedTask?.id ) {
      const stillSelected = this.filteredTasks.find( task => String( task.id ) === String( this.selectedTask?.id ) ) || null;
      this.selectedTask = stillSelected;
    }

    if ( !this.selectedTask ) {
      this.selectedTask = this.filteredTasks[0] || null;
    }

    this.publishPageContext();
    this.emitAssistantActivity( 'moves_filter_applied', {
      filterText: this.filterText,
      showCompleted: this.showCompleted,
      sortBy: this.sortBy,
      visibleMoves: this.filteredTasks.length
    } );
  }

  sortTasks ( tasks: Task[] ): Task[] {
    const next = [...tasks];

    if ( this.sortBy === 'title' ) {
      return next.sort( ( a, b ) => ( a.title || '' ).localeCompare( b.title || '', undefined, { sensitivity: 'base' } ) );
    }

    if ( this.sortBy === 'progress' ) {
      return next.sort( ( a, b ) => ( b.progress ?? 0 ) - ( a.progress ?? 0 ) );
    }

    return next.sort( ( a, b ) => {
      const aTime = a.dueDate ? new Date( a.dueDate ).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.dueDate ? new Date( b.dueDate ).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    } );
  }

  onFilterChange (): void {
    this.applyFilters();
  };

  onToggleCompleted (): void {
    this.applyFilters();
  };

  onSortChange (): void {
    this.applyFilters();
  };

  handleSelect ( task: Task ): void {
    this.selectedTask = task;
    this.activeTab = 'selected';
    this.publishPageContext();
    this.emitAssistantActivity( 'move_selected', {
      selectedMoveId: task?.id ? String( task.id ) : '',
      selectedMoveTitle: task?.title || ''
    } );
  };

  handleEdit ( task: Task ): void {
    this.logger.info( "TASK CHOSEN", task );
    if ( task?.id ) {
      this.taskService.setActiveTask( task );
      this.router.navigate( ['/move', task.id] );
    }
  }

  async handleComplete ( task: Task ): Promise<void> {
    this.logger.log( '[handleComplete] called. userId:', this.userId, '| task.id:', task.id, '| task.isCompleted (before toggle):', task.isCompleted );
    if ( !this.userId ) { this.logger.warn( '[handleComplete] no userId — aborting' ); return; }

    const updatedTask: Task = {
      ...task,
      isCompleted: !task.isCompleted,
      progress: task.isCompleted ? ( task.progress ?? 0 ) : 100
    };
    this.logger.log( '[handleComplete] updatedTask.isCompleted:', updatedTask.isCompleted, '| updatedTask.progress:', updatedTask.progress );

    try {
      const orUndefined = ( v: string | undefined ) => ( v?.trim() ? v.trim() : undefined );
      const normalizeStatus = ( s: string | undefined, completing: boolean ): string => {
        if ( completing ) return 'completed';
        const statusMap: Record<string, string> = { todo: 'not-started', stale: 'on-hold', archived: 'cancelled' };
        const normalized = ( s || 'not-started' ).toLowerCase();
        return statusMap[normalized] ?? ( ['not-started', 'in-progress', 'completed', 'on-hold', 'cancelled'].includes( normalized ) ? normalized : 'not-started' );
      };
      const normalizePriority = ( p: string | undefined ): 'low' | 'medium' | 'high' | 'urgent' => {
        const allowed: Array<'low' | 'medium' | 'high' | 'urgent'> = ['low', 'medium', 'high', 'urgent'];
        const lower = ( p || '' ).toLowerCase() as 'low' | 'medium' | 'high' | 'urgent';
        return allowed.includes( lower ) ? lower : 'medium';
      };
      await this.taskService.updateTask( updatedTask.id, {
        title: updatedTask.title,
        description: updatedTask.description,
        dueDate: orUndefined( updatedTask.dueDate ),
        progress: updatedTask.progress,
        status: normalizeStatus( updatedTask.status, !!updatedTask.isCompleted ),
        priority: normalizePriority( updatedTask.priority ),
        isCompleted: updatedTask.isCompleted,
        needsAttention: updatedTask.needsAttention,
        contactIds: updatedTask.contactIds,
        contacts: updatedTask.contacts,
        subTasks: updatedTask.subTasks,
        taskTypeId: orUndefined( updatedTask.taskTypeId ),
        projectId: orUndefined( updatedTask.projectId ),
        parentTaskId: orUndefined( updatedTask.parentTaskId ),
        startDate: orUndefined( updatedTask.startDate ),
        timerEndTime: orUndefined( updatedTask.timerEndTime ),
        timerStartTime: orUndefined( updatedTask.timerStartTime ),
        documents: updatedTask.documents,
        images: updatedTask.images,
        extensionDays: updatedTask.extensionDays,
        url: orUndefined( updatedTask.url ),
        timeToComplete: updatedTask.timeToComplete
      }, this.userId );
      this.logger.log( '[handleComplete] updateTask API succeeded. Updating local tasks array. tasks.length before:', this.tasks.length );
      this.tasks = this.tasks.map( item => String( item.id ) === String( updatedTask.id ) ? updatedTask : item );
      this.logger.log( '[handleComplete] tasks updated. Calling applyFilters. showCompleted:', this.showCompleted, '| filteredTasks.length before:', this.filteredTasks.length );
      this.applyFilters();
      this.logger.log( '[handleComplete] applyFilters done. filteredTasks.length after:', this.filteredTasks.length );
      this.publishPageContext();
      this.emitAssistantActivity( 'move_completion_toggled', {
        selectedMoveId: updatedTask?.id ? String( updatedTask.id ) : '',
        selectedMoveTitle: updatedTask?.title || '',
        isCompleted: !!updatedTask.isCompleted,
        progress: updatedTask.progress ?? 0
      } );
    } catch ( error ) {
      console.error( '[handleComplete] FAILED:', error );
      this.logger.error( 'Failed to update move completion', error );
    }
  };

  async applyAutomationLane ( lane: 'schedule' | 'status' | 'suggestions' ): Promise<void> {
    if ( !this.userId || this.automationBusy ) return;
    if ( !this.automationSettings[lane] ) {
      this.notificationService.show( 'Automation Paused', `Enable ${lane} automation to review this lane.`, 'success' );
      return;
    }

    if ( lane === 'suggestions' ) {
      const drafts = this.movesAutomationService.buildSuggestedMoveDrafts( this.tasks );

      if ( !drafts.length ) {
        this.notificationService.show( 'Automation Status', 'No suggested moves were needed.', 'success' );
        return;
      }

      this.pendingAutomationReview = {
        lane,
        label: 'Suggested moves',
        drafts,
        items: drafts.map( draft => ( {
          title: draft.task.title || 'Untitled move',
          detail: draft.reason
        } ) )
      };
      this.activeTab = 'overview';
      setTimeout( () => document.querySelector( '[data-cy="moves-review-queue"]' )?.scrollIntoView( { behavior: 'smooth', block: 'start' } ), 0 );
      return;
    }

    const patches = lane === 'schedule'
      ? this.movesAutomationService.buildScheduleAdjustmentPatches( this.tasks )
      : this.movesAutomationService.buildStatusAdjustmentPatches( this.tasks );

    if ( !patches.length ) {
      this.notificationService.show( 'Automation Status', `No ${lane} fixes were needed.`, 'success' );
      return;
    }

    this.pendingAutomationReview = {
      lane,
      label: lane === 'schedule' ? 'Schedule fixes' : 'Status fixes',
      patches,
      items: patches.map( patch => {
        const task = this.tasks.find( item => String( item.id ) === String( patch.taskId ) );
        return {
          title: task?.title || 'Untitled move',
          detail: patch.reason
        };
      } )
    };
    this.activeTab = 'overview';
    setTimeout( () => document.querySelector( '[data-cy="moves-review-queue"]' )?.scrollIntoView( { behavior: 'smooth', block: 'start' } ), 0 );
  }

  cancelPendingAutomation (): void {
    this.pendingAutomationReview = null;
  }

  async confirmPendingAutomation (): Promise<void> {
    if ( !this.userId || this.automationBusy || !this.pendingAutomationReview ) return;

    this.automationBusy = true;
    const pending = this.pendingAutomationReview;
    let updatedCount = 0;

    try {
      if ( pending.lane === 'suggestions' ) {
        const drafts = pending.drafts || [];
        await Promise.all( drafts.map( draft => this.createSuggestedMove( draft ) ) );
        updatedCount = drafts.length;
        this.recordAutomationHistory( pending.lane, `${updatedCount} suggested ${updatedCount === 1 ? 'move was' : 'moves were'} created.` );
      } else {
        const patches = pending.patches || [];
        await Promise.all( patches.map( patch => this.applyAutomationPatch( patch ) ) );
        updatedCount = patches.length;
        this.recordAutomationHistory( pending.lane, `${updatedCount} ${pending.lane} ${updatedCount === 1 ? 'update was' : 'updates were'} applied.` );
      }

      this.notificationService.show(
        'TODD Automation',
        `${updatedCount} ${updatedCount === 1 ? 'change was' : 'changes were'} approved and applied.`,
        'success'
      );
      this.pendingAutomationReview = null;
      this.applyFilters();
      this.publishPageContext();
      this.emitAssistantActivity( 'moves_automation_applied', {
        lane: pending.lane,
        updatedCount
      } );
    } catch ( error ) {
      this.logger.error( `Failed to confirm ${pending.lane} automation`, error );
      this.notificationService.show( 'Automation Error', 'TODD could not apply the approved automation right now.', 'error' );
    } finally {
      this.automationBusy = false;
    }
  }

  reviewAutomationLane ( lane: 'resources' ): void {
    if ( lane !== 'resources' ) return;
    if ( !this.automationSettings.resources ) {
      this.notificationService.show( 'Automation Paused', 'Enable resource automation to review resource gaps.', 'success' );
      return;
    }

    const candidates = this.movesAutomationService.findResourceAdjustmentCandidates( this.filteredTasks.length ? this.filteredTasks : this.tasks );
    const target = candidates[0] || null;

    if ( !target ) {
      this.notificationService.show( 'Automation Status', 'No resource gaps were detected.', 'success' );
      return;
    }

    this.selectedTask = target;
    this.activeTab = 'selected';
    this.currentView = 'checklist';
    sessionStorage.setItem( 'task-resource-guidance', JSON.stringify( this.movesAutomationService.getResourceRecommendation( target ) ) );
    this.publishPageContext();
    this.emitAssistantActivity( 'moves_resource_review_requested', {
      selectedMoveId: target?.id ? String( target.id ) : '',
      selectedMoveTitle: target?.title || ''
    } );
    this.notificationService.show(
      'TODD Resource Review',
      this.movesAutomationService.getResourceRecommendation( target ).summary,
      'success'
    );
    this.recordAutomationHistory( 'resources', `Opened resource review for "${target.title || 'Untitled move'}".` );
    this.handleEdit( target );
  }

  private async applyAutomationPatch ( patch: MoveAutomationPatch ): Promise<void> {
    const existing = this.tasks.find( task => String( task.id ) === String( patch.taskId ) );
    if ( !existing?.id ) return;

    await this.taskService.updateTask( existing.id, patch.changes, this.userId );

    this.tasks = this.tasks.map( task =>
      String( task.id ) === String( patch.taskId )
        ? { ...task, ...patch.changes }
        : task
    );
  }

  private async createSuggestedMove ( draft: SuggestedMoveDraft ): Promise<void> {
    const saved = await this.taskService.addTask( draft.task, this.userId );
    this.tasks = [...this.tasks, saved];
  }

  private loadAutomationHistory (): void {
    if ( !this.isBrowser ) return;

    try {
      const raw = window.localStorage.getItem( MOVES_AUTOMATION_HISTORY_KEY );
      this.automationHistory = raw ? JSON.parse( raw ) as AutomationHistoryEntry[] : [];
    } catch {
      this.automationHistory = [];
    }
  }

  private loadAutomationSettings (): void {
    if ( !this.isBrowser ) return;

    try {
      const raw = window.localStorage.getItem( MOVES_AUTOMATION_SETTINGS_KEY );
      if ( !raw ) return;

      const saved = JSON.parse( raw ) as Partial<MovesAutomationSettings>;
      this.automationSettings = {
        schedule: saved.schedule ?? true,
        status: saved.status ?? true,
        resources: saved.resources ?? true,
        suggestions: saved.suggestions ?? true
      };
    } catch {
      this.automationSettings = {
        schedule: true,
        status: true,
        resources: true,
        suggestions: true
      };
    }
  }

  private recordAutomationHistory ( lane: AutomationLaneKey | 'resources', summary: string ): void {
    const entry: AutomationHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString( 36 ).slice( 2, 8 )}`,
      lane,
      summary,
      timestamp: new Date().toISOString()
    };

    this.automationHistory = [entry, ...this.automationHistory].slice( 0, 8 );

    if ( this.isBrowser ) {
      try {
        window.localStorage.setItem( MOVES_AUTOMATION_HISTORY_KEY, JSON.stringify( this.automationHistory ) );
      } catch { }
    }
  }
}
