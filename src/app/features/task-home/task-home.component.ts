import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Task } from '../../models/task.model';
import { Subscription } from 'rxjs';
import { MovesAssistantSignalService } from '../../services/moves-assistant-signal.service';
import { MovesAuthService } from '../../services/moves-auth.service';
import { MovesEntitlementService } from '../../services/moves-entitlement.service';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { getModuleInstallConfig } from '../../shared/utils/module-install-config.util';
import { ArcGaugeComponent, ArcGaugeTone } from '../../shared/arc-gauge/arc-gauge.component';
import { BusinessSymptom } from '../../models/business-symptom.model';
import { TaskApiService } from '../../services/task-api.service';
import { MovesPageActionsService } from '../../services/moves-page-actions.service';
import { CockpitCommandDeckComponent, CockpitCommandDeckLink } from '../../shared/cockpit-command-deck/cockpit-command-deck.component';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';
import { PageAction } from '../../models/page-actions.models';
import { StatusLedComponent } from '../../shared/status-led/status-led.component';
import { buildCockpitDiagnosisRows, CockpitDiagnosisRowVm } from '../../shared/utils/cockpit-diagnosis-board.util';

/**
 * Near-verbatim port of features/tasks/task-home/task-home.component.ts -
 * this app's `/app` (and legacy `/moves`) route, matching how Network
 * dropped `network/app` -> `/app`. Judgment calls, all route-only:
 *  - `routerLink: '/'` (cockpit deck's "Home") now points at `/app` -
 *    there's no separate TODD hub page in this standalone app; Moves' own
 *    home IS the hub.
 *  - `/mission` (Mission Workspace) is TODD's Goal Engine, a different,
 *    larger feature not part of this extraction (see mission.model.ts's
 *    doc comment) - both the command-deck link and the page-actions entry
 *    now open it cross-domain at todd.taliferro.tech/mission rather than
 *    routing to a page that doesn't exist here.
 *  - `moves/ai-missions` drops its disambiguating prefix to `/ai-missions`,
 *    same rule as `/app`.
 */
@Component( {
  selector: 'app-task-home',
  standalone: true,
  imports: [CommonModule, RouterModule, BackToTopComponent, ArcGaugeComponent, CockpitCommandDeckComponent, CockpitBrowseModeBannerComponent, StatusLedComponent],
  templateUrl: './task-home.component.html',
  styleUrl: './task-home.component.css'
} )
export class TaskHomeComponent implements OnInit, OnDestroy {
  readonly executionCommandDeckLinks: CockpitCommandDeckLink[] = [
    { label: 'Home', icon: 'house', routerLink: '/app' },
    { label: 'Execution Board', icon: 'table-cells-large', routerLink: '/moves-view' },
    { label: 'Create a Move', icon: 'square-plus', routerLink: '/move' },
    { label: 'Mission Workspace', icon: 'compass', action: () => window.location.assign( 'https://todd.taliferro.tech/mission' ) },
    { label: 'AI Missions', icon: 'robot', routerLink: '/ai-missions' }
  ];

  readonly installConfig = getModuleInstallConfig( 'moves' );
  readonly entitlements$ = inject( MovesEntitlementService ).getEntitlements();
  readonly guestExecutionSymptoms: BusinessSymptom[] = [
    {
      id: 'execution-deadlines-slipping',
      title: 'Deadlines are slipping',
      description: 'Late work is building pressure.',
      severity: 'medium',
      reliefStatus: 'insufficient-information',
      evidence: [
        { label: 'Overdue', value: '0', detail: 'Live after connect.' }
      ],
      toddActions: [
        { label: 'Reprioritize', detail: 'Available after connect.' }
      ],
      progress: { summary: 'Live after connect.' },
      outcome: {
        label: 'Recovered',
        value: '0',
        detail: 'Proof appears with live data.',
        observed: false
      },
      trend: 'unknown',
      module: 'moves'
    },
    {
      id: 'execution-blockers-hidden',
      title: 'Blocked work is staying hidden',
      description: 'Blocked work is not surfacing cleanly.',
      severity: 'medium',
      reliefStatus: 'insufficient-information',
      evidence: [
        { label: 'Blocked', value: '0', detail: 'Live after connect.' }
      ],
      toddActions: [
        { label: 'Escalate', detail: 'Available after connect.' }
      ],
      progress: { summary: 'Live after connect.' },
      outcome: {
        label: 'Cleared',
        value: '0',
        detail: 'Proof appears with live data.',
        observed: false
      },
      trend: 'unknown',
      module: 'moves'
    },
    {
      id: 'execution-no-plan',
      title: 'Work has no coordinated plan',
      description: 'Work is active without a shared sequence.',
      severity: 'medium',
      reliefStatus: 'insufficient-information',
      evidence: [
        { label: 'Linked', value: '0', detail: 'Live after connect.' }
      ],
      toddActions: [
        { label: 'Link to mission', detail: 'Available after connect.' }
      ],
      progress: { summary: 'Live after connect.' },
      outcome: {
        label: 'Flow',
        value: '0',
        detail: 'Proof appears with live data.',
        observed: false
      },
      trend: 'unknown',
      module: 'moves'
    }
  ];
  private signalSubscription!: Subscription;
  private firebaseUserSubscription!: Subscription;
  private taskLoadSubscription?: Subscription;
  toddSignalState: 'idle' | 'listening' | 'thinking' | 'ready' = 'idle';
  hasAuthenticatedUser: boolean = false;
  tasks: Task[] = [];
  executionHealthMeters: Array<{ id: string; label: string; value: number; tone: ArcGaugeTone; detail: string; }> = [];
  executionScore = 0;
  executionAppStatus = 'Stand by. Connect Moves to light the panel.';
  executionStatusGauge: { label: string; readout: string; value: number; max: number; tone: ArcGaugeTone; } = {
    label: 'Pressure',
    readout: '0/0',
    value: 0,
    max: 1,
    tone: 'info'
  };
  visibleExecutionSymptoms: BusinessSymptom[] = [];
  diagnosisRowsVm: CockpitDiagnosisRowVm[] = [];

  constructor (
    private authService: MovesAuthService,
    private toddAssistantBusService: MovesAssistantSignalService,
    private taskService: TaskApiService,
    private router: Router,
    private pageActionsService: MovesPageActionsService
  ) { }

  ngOnInit (): void {
    this.signalSubscription = this.toddAssistantBusService.signalState$
      .subscribe( state => {
        this.toddSignalState = state;
      } );

    this.firebaseUserSubscription = this.authService.getUser().subscribe( firebaseUser => {
      this.hasAuthenticatedUser = !!( firebaseUser && firebaseUser.uid );
      this.loadExecutionTasks( firebaseUser?.uid || '' );
      this.publishPageContext();
    } );

    this.publishPageContext();
    this.publishPageActions();
  }
  ngOnDestroy (): void {
    if ( this.signalSubscription ) this.signalSubscription.unsubscribe();
    if ( this.firebaseUserSubscription ) this.firebaseUserSubscription.unsubscribe();
    this.taskLoadSubscription?.unsubscribe();
    this.pageActionsService.clearPageActions( 'task-home-cockpit' );
    this.toddAssistantBusService.clearPageContext();
  }

  private publishPageActions (): void {
    this.pageActionsService.setPageActions( {
      pageId: 'task-home-cockpit',
      context: {
        pageId: 'task-home-cockpit',
        feature: 'moves',
        entityType: 'task',
        mode: 'dashboard'
      },
      actions: this.buildPageActions()
    } );
  }

  private buildPageActions (): PageAction[] {
    return [
      {
        id: 'task-cockpit-board',
        label: 'Execution Board',
        icon: 'fa-solid fa-table-columns',
        kind: 'route',
        route: '/moves-view',
        order: 10,
        group: 'context'
      },
      {
        id: 'task-cockpit-create',
        label: 'Create a Move',
        icon: 'fa-solid fa-plus',
        kind: 'route',
        route: '/move',
        order: 20,
        group: 'context'
      },
      {
        id: 'task-cockpit-mission',
        label: 'Mission Workspace',
        icon: 'fa-solid fa-bullseye',
        kind: 'callback',
        handler: () => window.location.assign( 'https://todd.taliferro.tech/mission' ),
        order: 30,
        group: 'context'
      },
      {
        id: 'task-cockpit-ai-missions',
        label: 'AI Missions',
        icon: 'fa-solid fa-robot',
        kind: 'route',
        route: '/ai-missions',
        order: 40,
        group: 'context'
      }
    ];
  }

  private buildVisibleExecutionSymptoms (): BusinessSymptom[] {
    if ( !this.hasAuthenticatedUser ) {
      return this.guestExecutionSymptoms;
    }

    return [
      {
        id: 'execution-deadlines-slipping-live',
        title: 'Deadlines are slipping',
        description: 'Late work is building pressure.',
        severity: this.overdueMoveCount >= 5 ? 'critical' : this.overdueMoveCount >= 2 ? 'high' : this.overdueMoveCount >= 1 ? 'medium' : 'low',
        reliefStatus: this.overdueMoveCount > 0 ? 'needs-relief' : 'relief-delivered',
        evidence: [
          {
            label: 'Overdue',
            value: String( this.overdueMoveCount ),
            detail: this.overdueMoveCount > 0
              ? `${this.overdueMoveCount} late`
              : '0 late'
          }
        ],
        toddActions: [
          {
            label: 'Surface pressure',
            detail: 'Focus overdue work first.'
          }
        ],
        progress: {
          summary: this.completedMoveCount > 0
            ? `${this.completedMoveCount} closed`
            : '0 closed'
        },
        outcome: {
          label: 'Closed',
          value: String( this.completedMoveCount ),
          detail: this.completedMoveCount > 0
            ? 'Work is closing.'
            : 'Waiting on closes.',
          observed: this.completedMoveCount > 0
        },
        trend: this.overdueMoveCount > 0 ? 'declining' : 'stable',
        module: 'moves'
      },
      {
        id: 'execution-blocked-live',
        title: 'Blocked work is staying hidden',
        description: 'Blocked work is not standing out.',
        severity: this.onHoldMoveCount >= 4 ? 'high' : this.onHoldMoveCount >= 1 ? 'medium' : 'low',
        reliefStatus: this.onHoldMoveCount > 0 ? 'todd-working' : 'watching',
        evidence: [
          {
            label: 'Paused',
            value: String( this.onHoldMoveCount ),
            detail: this.onHoldMoveCount > 0
              ? `${this.onHoldMoveCount} paused`
              : '0 paused'
          }
        ],
        toddActions: [
          {
            label: 'Expose blocks',
            detail: 'Keep blocked work visible.'
          }
        ],
        progress: {
          summary: this.activeOpenMoveCount > 0
            ? `${this.activeOpenMoveCount} moving`
            : '0 moving'
        },
        outcome: {
          label: 'Moving',
          value: String( this.activeOpenMoveCount ),
          detail: this.activeOpenMoveCount > 0
            ? 'Work is still moving.'
            : 'Waiting on motion.',
          observed: this.activeOpenMoveCount > 0
        },
        trend: this.onHoldMoveCount > 0 ? 'stable' : 'improving',
        module: 'moves'
      },
      {
        id: 'execution-plan-live',
        title: 'Work has no coordinated plan',
        description: 'Work needs a shared path.',
        severity: this.missionLinkedMoveCount === 0 && this.totalMoveCount > 0 ? 'high' : this.totalMoveCount === 0 ? 'medium' : 'low',
        reliefStatus: this.missionLinkedMoveCount > 0 ? 'improving' : 'needs-user-decision',
        evidence: [
          {
            label: 'Mission-linked',
            value: String( this.missionLinkedMoveCount ),
            detail: this.missionLinkedMoveCount > 0
              ? `${this.missionLinkedMoveCount} linked`
              : '0 linked'
          }
        ],
        toddActions: [
          {
            label: 'Link work',
            detail: 'Tie moves to a mission.'
          }
        ],
        progress: {
          summary: this.totalMoveCount > 0
            ? `${this.totalMoveCount} tracked`
            : '0 tracked'
        },
        outcome: {
          label: 'Tracked',
          value: String( this.totalMoveCount ),
          detail: this.totalMoveCount > 0
            ? 'There is enough to organize.'
            : 'Add the first move.',
          observed: this.totalMoveCount > 0
        },
        trend: this.missionLinkedMoveCount > 0 ? 'improving' : 'unknown',
        module: 'moves',
        requiresUserAction: this.missionLinkedMoveCount === 0 && this.totalMoveCount > 0,
        userActionLabel: this.missionLinkedMoveCount === 0 && this.totalMoveCount > 0 ? 'Open Mission Workspace' : undefined,
        userActionRoute: this.missionLinkedMoveCount === 0 && this.totalMoveCount > 0 ? 'https://todd.taliferro.tech/mission' : null
      }
    ];
  }

  get totalMoveCount (): number {
    return this.tasks.length;
  }

  get completedMoveCount (): number {
    return this.tasks.filter( task => this.isCompletedTask( task ) ).length;
  }

  get overdueMoveCount (): number {
    return this.tasks.filter( task => this.isOverdueTask( task ) ).length;
  }

  get openMoveCount (): number {
    return this.tasks.filter( task => !this.isCompletedTask( task ) ).length;
  }

  get missionLinkedMoveCount (): number {
    return this.tasks.filter( task => !!String( task.projectId || '' ).trim() ).length;
  }

  get onHoldMoveCount (): number {
    return this.tasks.filter( task => {
      const status = String( task.status || '' ).trim().toLowerCase();
      return !this.isCompletedTask( task ) && ( status === 'on-hold' || status === 'blocked' || status === 'paused' );
    } ).length;
  }

  get activeOpenMoveCount (): number {
    return this.tasks.filter( task => !this.isCompletedTask( task ) && !this.isOverdueTask( task ) ).length;
  }

  trackByExecutionMeter ( _index: number, meter: { id: string; } ): string {
    return meter.id;
  }

  trackBySymptomId ( _index: number, symptom: BusinessSymptom ): string {
    return symptom.id;
  }

  trackByDiagnosisRowId ( _index: number, row: CockpitDiagnosisRowVm ): string {
    return row.id;
  }

  private loadExecutionTasks ( userId: string ): void {
    this.taskLoadSubscription?.unsubscribe();

    if ( !this.hasAuthenticatedUser || !userId ) {
      this.tasks = [];
      this.rebuildExecutionViewModel();
      this.publishPageContext();
      return;
    }

    this.taskLoadSubscription = this.taskService.loadTasks( userId ).subscribe( {
      next: tasks => {
        this.tasks = tasks || [];
        this.rebuildExecutionViewModel();
        this.publishPageContext();
      },
      error: () => {
        this.tasks = [];
        this.rebuildExecutionViewModel();
        this.publishPageContext();
      }
    } );
  }

  private rebuildExecutionViewModel (): void {
    const moveBase = this.totalMoveCount || 1;
    const scheduleHealth = this.hasAuthenticatedUser ? Math.max( 0, 100 - Math.round( ( this.overdueMoveCount / moveBase ) * 100 ) ) : 0;
    const ownerClarity = this.hasAuthenticatedUser ? Math.round( ( this.missionLinkedMoveCount / moveBase ) * 100 ) : 0;
    const blockerVisibility = this.hasAuthenticatedUser ? Math.max( 0, 100 - Math.round( ( this.onHoldMoveCount / moveBase ) * 100 ) ) : 0;
    const completionMomentum = this.hasAuthenticatedUser ? Math.round( ( this.completedMoveCount / moveBase ) * 100 ) : 0;

    this.executionHealthMeters = [
      {
        id: 'deadline-health',
        label: 'Deadline health',
        value: scheduleHealth,
        tone: this.hasAuthenticatedUser ? this.toneFromPercent( scheduleHealth, false ) : 'info',
        detail: this.hasAuthenticatedUser
          ? `${this.overdueMoveCount} overdue move${this.overdueMoveCount === 1 ? '' : 's'} are pressuring the schedule.`
          : 'Live deadline health appears after sign-in.'
      },
      {
        id: 'owner-clarity',
        label: 'Owner clarity',
        value: ownerClarity,
        tone: this.hasAuthenticatedUser ? this.toneFromPercent( ownerClarity, false ) : 'info',
        detail: this.hasAuthenticatedUser
          ? `${this.missionLinkedMoveCount} move${this.missionLinkedMoveCount === 1 ? '' : 's'} are tied to a broader mission or project.`
          : 'Owner and mission clarity appears after sign-in.'
      },
      {
        id: 'blocker-visibility',
        label: 'Blocker visibility',
        value: blockerVisibility,
        tone: this.hasAuthenticatedUser ? this.toneFromPercent( blockerVisibility, false ) : 'info',
        detail: this.hasAuthenticatedUser
          ? `${this.onHoldMoveCount} move${this.onHoldMoveCount === 1 ? '' : 's'} are paused or on hold right now.`
          : 'Blocked-work visibility appears after sign-in.'
      },
      {
        id: 'execution-momentum',
        label: 'Execution momentum',
        value: completionMomentum,
        tone: this.hasAuthenticatedUser ? this.toneFromPercent( completionMomentum, false ) : 'info',
        detail: this.hasAuthenticatedUser
          ? `${this.completedMoveCount} move${this.completedMoveCount === 1 ? '' : 's'} have already been completed.`
          : 'Execution momentum appears after sign-in.'
      }
    ];

    this.executionScore = this.executionHealthMeters.length
      ? Math.round( this.executionHealthMeters.reduce( ( sum, meter ) => sum + meter.value, 0 ) / this.executionHealthMeters.length )
      : 0;

    this.executionStatusGauge = {
      label: 'Pressure',
      readout: `${this.overdueMoveCount}/${this.openMoveCount}`,
      value: this.overdueMoveCount,
      max: Math.max( this.openMoveCount, 1 ),
      tone: !this.hasAuthenticatedUser
        ? 'info'
        : this.overdueMoveCount >= Math.max( 1, this.openMoveCount )
          ? 'warn'
          : this.overdueMoveCount > 0
            ? 'attention'
            : 'positive'
    };

    if ( !this.hasAuthenticatedUser ) {
      this.executionAppStatus = 'Stand by. Connect Moves to light the panel.';
    } else if ( this.overdueMoveCount > 0 ) {
      this.executionAppStatus = `${this.overdueMoveCount} overdue. Pressure visible.`;
    } else if ( this.totalMoveCount > 0 ) {
      this.executionAppStatus = `${this.totalMoveCount} tracked. Panel live.`;
    } else {
      this.executionAppStatus = 'No moves yet. Ready when you are.';
    }

    this.visibleExecutionSymptoms = this.buildVisibleExecutionSymptoms();
    this.diagnosisRowsVm = buildCockpitDiagnosisRows( this.visibleExecutionSymptoms );
  }

  private publishPageContext (): void {
    this.toddAssistantBusService.setPageContext( {
      feature: 'moves',
      page: 'task-home',
      route: this.router.url || '/app',
      mode: 'dashboard',
      title: 'Execution',
      description: 'Compact execution panel for pressure, blockers, and flow.',
      allowedActions: [
        'open_moves_board',
        'create_move',
        'open_mission_workspace',
        'open_ai_missions'
      ],
      summary: {
        isAuthenticated: this.hasAuthenticatedUser,
        interactionMode: this.hasAuthenticatedUser ? 'member' : 'guest',
        totalMoveCount: this.totalMoveCount,
        completedMoveCount: this.completedMoveCount,
        overdueMoveCount: this.overdueMoveCount,
        missionLinkedMoveCount: this.missionLinkedMoveCount,
        onHoldMoveCount: this.onHoldMoveCount,
        activeOpenMoveCount: this.activeOpenMoveCount,
        executionScore: this.executionScore
      },
      dataPreview: {
        appStatus: this.executionAppStatus,
        movesBoardRoute: '/moves-view',
        createMoveRoute: '/move',
        missionRoute: 'https://todd.taliferro.tech/mission',
        aiMissionsRoute: '/ai-missions'
      }
    } );
  }

  private isCompletedTask ( task: Task | null | undefined ): boolean {
    if ( !task ) return false;
    const status = String( task.status || '' ).trim().toLowerCase();
    return !!task.isCompleted || status === 'completed' || status === 'cancelled';
  }

  private isOverdueTask ( task: Task | null | undefined ): boolean {
    if ( !task || this.isCompletedTask( task ) || !task.dueDate ) return false;
    const dueTime = new Date( task.dueDate ).getTime();
    return Number.isFinite( dueTime ) && dueTime < Date.now();
  }

  private toneFromPercent ( percent: number, inverse: boolean ): ArcGaugeTone {
    const score = inverse ? 100 - percent : percent;
    if ( score >= 75 ) return 'positive';
    if ( score >= 45 ) return 'attention';
    return 'warn';
  }

}
