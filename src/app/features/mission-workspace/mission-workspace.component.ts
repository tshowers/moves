import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, take } from 'rxjs';

import { GoalApiService } from '../../services/goal-api.service';
import { ToddMissionIntake, ToddMissionMove, ToddMissionRecord, ToddMissionType } from '../../models/mission.model';
import { LoggerService } from '../../services/logger.service';
import { MovesAssistantSignalService } from '../../services/moves-assistant-signal.service';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { SectionJumpComponent, SectionJumpItem } from '../../shared/section-jump/section-jump.component';
import { TaskApiService } from '../../services/task-api.service';
import { Task } from '../../models/task.model';
import { MovesNotificationService } from '../../services/moves-notification.service';
import { MovesOnboardingService } from '../../services/moves-onboarding.service';
import { MovesAuthService } from '../../services/moves-auth.service';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';

type MissionFormModel = {
  title: string;
  missionType: ToddMissionType;
  problemStatement: string;
  desiredOutcome: string;
  resourcesText: string;
  stakeholdersText: string;
  constraintsText: string;
  timeline: string;
  successCriteriaText: string;
  companyDescription: string;
  mission: string;
  valueProposition: string;
};

type MissionHelperCard = {
  title: string;
  body: string;
  bullets: string[];
};

type MissionComposerDraft = {
  draftType: string;
  title: string;
  body: string;
  audienceLabel: string;
};

/** Shape reported to MovesAssistantSignalService.setPageContext() - Moves'
 * no-op stand-in for ToddAssistantBusService, so this stays a plain local
 * type instead of an import (there is nothing on the other end to read it
 * yet, but the shape is kept so a real Moves-scoped assistant has
 * somewhere to plug in later). */
type AssistantPageContext = {
  feature: string;
  page: string;
  route: string;
  mode: string;
  title: string;
  description: string;
  allowedActions: string[];
  selectedEntityType: string;
  selectedEntityId: string;
  summary: Record<string, unknown>;
  dataPreview: Record<string, unknown>;
};

/**
 * Ported from features/help/mission-workspace/mission-workspace.component.ts.
 * TODD's strategic "Goal Engine" mission planner (intake -> AI plan
 * preview -> approve -> real Moves), routed here at /plan rather than
 * TODD's own /mission (too close to the existing /move/:id/mission route
 * for the AiMissionDetailComponent's unrelated autonomous-agent concept -
 * see mission-workspace-migration-plan.md for the full writeup).
 *
 * Adapted from the source per the settled migration decisions:
 * - Writing-identity auto-fill (ToddWritingIdentityService) dropped -
 *   applyIdentityDefaults() and the identity fields in the intake form
 *   default to blank instead of being pre-filled from a company profile.
 * - Onboarding "first win" tracking ported for real via
 *   MovesOnboardingService (see that file for why it's a scoped port,
 *   not the whole 515-line cross-product onboarding system).
 * - Demo mode (?demo=1) ported as-is.
 * - openCommunicationDraftInComposer() still points at /compose-email,
 *   a Docs/TODD-shell route that isn't part of this app - same "degrade
 *   to the app's own not-found page rather than invent a fake one"
 *   posture as ai-mission-detail.component.ts's artifactLink().
 */
@Component( {
  selector: 'app-mission-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PreloaderComponent, BackToTopComponent, SectionJumpComponent, ClickSoundDirective, CockpitBrowseModeBannerComponent],
  templateUrl: './mission-workspace.component.html',
  styleUrl: './mission-workspace.component.css'
} )
export class MissionWorkspaceComponent implements OnInit, OnDestroy {
  @ViewChild( 'helperCardRef' ) helperCardRef?: ElementRef<HTMLElement>;

  private readonly allSectionLinks: ReadonlyArray<SectionJumpItem> = [
    { id: 'mission-intake', label: 'Intake' },
    { id: 'mission-recent', label: 'Recent' },
    { id: 'mission-plan', label: 'Plan' },
    { id: 'mission-moves', label: 'Moves' }
  ];
  sectionLinks: ReadonlyArray<SectionJumpItem> = [{ id: 'mission-intake', label: 'Intake' }];

  readonly missionTypeOptions: Array<{ value: ToddMissionType; label: string; description: string; }> = [
    {
      value: 'project_delivery_outcome',
      label: 'Project Delivery Outcome',
      description: 'Use TODD to run delivery, handoffs, scope, and execution against a real project outcome.'
    },
    {
      value: 'campaign_execution_outcome',
      label: 'Campaign Execution Outcome',
      description: 'Use TODD to coordinate the work, assets, risks, and follow-through needed to ship a campaign.'
    },
    {
      value: 'client_success_outcome',
      label: 'Client Success Outcome',
      description: 'Use TODD to keep stakeholders aligned, surface blockers, and protect the client outcome.'
    },
    {
      value: 'daily_revenue_outcome',
      label: 'Daily Revenue Outcome',
      description: 'Use TODD for an outcome that still matters daily, but is broader than the Daily Momentum page.'
    }
  ];

  form: MissionFormModel = this.createDefaultForm();
  loading = false;
  generatingPlan = false;
  approvingPlan = false;
  missionError = '';
  currentMission: ToddMissionRecord | null = null;
  hasPreview = false;
  hasLiveMission = false;
  canApprove = false;
  hasRevisionPreview = false;
  healthSummary: ToddMissionRecord['health'] | ToddMissionRecord['progress'] | null = null;
  revisionCount = 0;
  lastRevisedAt = '';
  plannedMoves: ToddMissionMove[] = [];
  openMoves: ToddMissionMove[] = [];
  blockedMoves: ToddMissionMove[] = [];
  completedMoves: ToddMissionMove[] = [];
  supersededMoves: ToddMissionMove[] = [];
  currentPhaseLabel = 'Current phase';
  visibleMilestones: Array<{ id?: string; title?: string; objective?: string; deliverables?: string[]; }> = [];
  communicationDraftEntries: Array<{ key: string; title: string; body: string; }> = [];
  missionCommunicationNotes: Array<{ title?: string; body?: string; audienceLabel?: string; updatedAt?: string; draftType?: string; }> = [];
  helperCard: MissionHelperCard | null = null;
  editingMission = false;
  savingMission = false;
  updatingMissionStatus = false;
  applyNetNewMovesOnApprove = true;
  focusMode = false;
  missionComposerOpen = false;
  missionComposer: MissionComposerDraft = this.createEmptyComposerDraft();
  guidedMode: 'project' | 'not-sure' | null = null;
  readonly demoModeSupported = true;
  demoModeEnabled = false;
  userId: string | null = null;
  tenantId: string | null = null;

  private queryParamSubscription?: Subscription;
  private engagementActionSubscription?: Subscription;
  private authSubscription = new Subscription();
  private _previewMission: ToddMissionRecord | null = null;
  private _activeMission: ToddMissionRecord | null = null;
  private _recentMissions: ToddMissionRecord[] = [];
  private userContextResolved = false;
  private tenantContextResolved = false;
  private hydratedPendingPreview = false;
  private readonly pendingPreviewStoragePrefix = 'moves:mission-workspace:pending-preview';

  constructor (
    private readonly goalService: GoalApiService,
    private readonly logger: LoggerService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly authService: MovesAuthService,
    private readonly assistantBus: MovesAssistantSignalService,
    private readonly taskService: TaskApiService,
    private readonly notificationService: MovesNotificationService,
    private readonly onboardingService: MovesOnboardingService
  ) { }

  ngOnInit (): void {
    this.bindEngagementActions();
    this.authSubscription.add(
      this.authService.getUserId().subscribe( userId => {
        this.userId = userId || null;
        this.userContextResolved = true;
        this.tryRestorePendingPreview();
      } )
    );
    this.authSubscription.add(
      this.authService.getTenantId().subscribe( tenantId => {
        this.tenantId = tenantId || null;
        this.tenantContextResolved = true;
        this.tryRestorePendingPreview();
      } )
    );
    this.demoModeEnabled = this.isDemoParamEnabled( this.route.snapshot.queryParamMap );
    if ( this.demoModeEnabled ) {
      this.activateMissionDemoMode();
    } else {
      this.loadRecentMissions();
    }

    this.queryParamSubscription = this.route.queryParamMap.subscribe( params => {
      const missionId = String( params.get( 'missionId' ) || '' ).trim();
      const demoEnabled = this.isDemoParamEnabled( params );
      const guided = String( params.get( 'guided' ) || '' ).trim();

      if ( demoEnabled && !this.demoModeEnabled ) {
        this.demoModeEnabled = true;
        this.activateMissionDemoMode();
        return;
      }

      if ( !demoEnabled && this.demoModeEnabled ) {
        this.demoModeEnabled = false;
        this.deactivateMissionDemoMode();
      }

      if ( guided === 'project' || guided === 'not-sure' ) {
        this.guidedMode = guided;
        this.applyGuidedMissionStarter( guided );
        this.clearGuidedParams();
      }

      // Source bug fixed here: approving a demo mission syncs `missionId`
      // into the URL (see approveAndCreateMoves()'s router.navigate), and
      // without the `!demoEnabled` guard this re-fires as a real backend
      // load for a demo-only id, 401s, and stomps the working demo state
      // with "Authentication required for this data." Demo mission data
      // is already fully set client-side - nothing to load.
      if ( missionId && !demoEnabled ) {
        this.loadMission( missionId );
      } else if ( !demoEnabled ) {
        this.tryRestorePendingPreview();
        this.publishPageContext();
      }
    } );
  }

  ngOnDestroy (): void {
    this.authSubscription.unsubscribe();
    this.queryParamSubscription?.unsubscribe();
    this.engagementActionSubscription?.unsubscribe();
    this.assistantBus.clearPageContext();
  }

  private applyGuidedMissionStarter ( guidedMode: 'project' | 'not-sure' ): void {
    if ( !this.form.title.trim() ) {
      this.form.title = guidedMode === 'project'
        ? 'Deliver the next client milestone'
        : 'Get one stalled priority moving';
    }

    if ( !this.form.problemStatement.trim() ) {
      this.form.problemStatement = guidedMode === 'project'
        ? 'The work is moving, but the team needs a clearer plan, owners, and near-term priorities.'
        : 'I know something needs attention, but the next best move is still fuzzy.';
    }

    if ( !this.form.desiredOutcome.trim() ) {
      this.form.desiredOutcome = guidedMode === 'project'
        ? 'Leave with a short, actionable plan that shows what to do first and what could block delivery.'
        : 'Leave with one concrete plan I can act on today.';
    }

    if ( !this.form.resourcesText.trim() ) {
      this.form.resourcesText = guidedMode === 'project'
        ? 'Project owner\nDelivery lead\nExisting docs and notes'
        : 'My time\nCurrent notes\nWhoever needs to stay aligned';
    }

    if ( !this.form.timeline.trim() ) {
      this.form.timeline = guidedMode === 'project'
        ? 'Next 14 days'
        : 'This week';
    }
  }

  private completeGuidedFirstWin (): void {
    const context = this.getOnboardingContext();
    if ( !context || !this.guidedMode || !this.previewMission ) {
      return;
    }

    this.onboardingService.completeFirstWin(
      context,
      this.guidedMode === 'project' ? 'project' : 'not-sure'
    );
  }

  private clearGuidedParams (): void {
    this.router.navigate( [], {
      relativeTo: this.route,
      queryParams: {
        guided: null,
        firstWin: null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    } );
  }

  private isDemoParamEnabled ( params: { get: ( key: string ) => string | null; } ): boolean {
    const queryParamValue = String( params.get( 'demo' ) || '' ).trim().toLowerCase();
    return this.demoModeSupported && ['1', 'true', 'yes', 'on'].includes( queryParamValue );
  }

  private activateMissionDemoMode (): void {
    this.form = this.buildDemoMissionForm();
    this.previewMission = this.buildDemoMissionPreview();
    this.activeMission = null;
    this.helperCard = null;
    this.missionError = '';
    this.generatingPlan = false;
    this.approvingPlan = false;
    this.editingMission = false;
    this.refreshDerivedState();
    this.publishPageContext();
  }

  private deactivateMissionDemoMode (): void {
    this.previewMission = null;
    this.activeMission = null;
    this.helperCard = null;
    this.missionError = '';
    this.refreshDerivedState();
    this.loadRecentMissions();
    this.publishPageContext();
  }

  private buildDemoMissionForm (): MissionFormModel {
    return {
      title: 'Launch the next delivery milestone',
      missionType: 'project_delivery_outcome',
      problemStatement: 'The team needs a better plan to ship the upcoming release without scope creep.',
      desiredOutcome: 'Create a short, actionable mission plan that keeps the next milestone on track.',
      resourcesText: 'Engineering lead\nProduct owner\nCustomer success lead',
      stakeholdersText: 'CEO\nOperations\nSupport team',
      constraintsText: 'No headcount increase\nTight delivery window',
      timeline: 'Next 14 days',
      successCriteriaText: 'Milestone delivered\nStakeholders aligned\nNo critical regression',
      companyDescription: 'We help fast-growing teams ship product updates faster and with more confidence.',
      mission: 'Get the feature launch ready and aligned across teams.',
      valueProposition: 'Drive faster onboarding and activation through a smoother launch process.'
    };
  }

  private buildDemoMissionPreview (): ToddMissionRecord {
    return this.buildDemoMissionRecord( this.buildMissionPayload() );
  }

  private buildDemoMissionRecord ( payload: ToddMissionIntake ): ToddMissionRecord {
    const taskPlan = [
      {
        title: 'Clarify the mission brief',
        description: 'Make the outcome and scope crystal clear for the delivery team.',
        phase: 'frame',
        priority: 'high'
      },
      {
        title: 'Align stakeholders on priorities',
        description: 'Confirm what must ship and what can be deferred.',
        phase: 'frame',
        priority: 'high'
      },
      {
        title: 'Validate the launch dependencies',
        description: 'Identify the critical risks and handoffs that could delay delivery.',
        phase: 'deliver',
        priority: 'urgent'
      }
    ];

    return {
      id: 'demo-preview-1',
      missionType: payload.missionType,
      status: 'planned',
      title: payload.title,
      intake: payload,
      plan: {
        projectSummary: `${payload.title}: TODD is keeping the next delivery milestone focused and aligned.`,
        successCriteria: payload.successCriteria,
        milestones: [
          {
            id: 'frame',
            title: 'Frame the mission',
            objective: 'Capture the mission outcome and delivery risks.',
            deliverables: ['Mission brief', 'Stakeholder alignment', 'Delivery checklist']
          },
          {
            id: 'deliver',
            title: 'Prepare delivery execution',
            objective: 'Turn the plan into actionable Moves and remove blockers.',
            deliverables: ['Validated dependencies', 'Launch readiness review']
          }
        ],
        taskPlan,
        blockerAssumptions: [
          `Constraint to manage: ${( payload.constraints || [] ).join( ', ' )}`
        ],
        nextRecommendedMove: {
          label: 'Clarify the mission brief',
          description: 'Make the outcome and scope crystal clear for the delivery team.'
        }
      },
      moves: [],
      progress: {
        totalCount: taskPlan.length,
        openCount: taskPlan.length,
        completedCount: 0,
        blockedCount: 0,
        inProgressCount: 0,
        completionPercent: 0
      },
      drift: {
        label: 'Steady',
        explanation: 'TODD is watching the mission and building the right next steps.',
        signals: []
      },
      risks: [
        ...( payload.constraints || [] ).map( constraint => `Risk: ${constraint}` )
      ],
      communicationDrafts: {
        stakeholderStatusUpdate: `TODD recommends sharing progress with stakeholders and confirming the next milestone review.`,
        blockerEscalationUpdate: `TODD has identified a delivery constraint and suggests escalating it for early resolution.`,
        decisionRequestUpdate: `TODD recommends a decision on priority scope to keep the milestone on track.`,
        progressSummaryNote: `TODD is preparing the mission plan and tracking progress against the next delivery milestone.`
      },
      statusUpdateDraft: `TODD is preparing the mission brief and aligning stakeholders for the next milestone.`,
      health: {
        totalCount: taskPlan.length,
        openCount: taskPlan.length,
        blockedCount: 0,
        completedCount: 0,
        overdueCount: 0,
        completionPercent: 0,
        currentRiskLevel: 'medium',
        topRisk: ( payload.constraints || [] )[0] || ''
      }
    } as ToddMissionRecord;
  }

  private getOnboardingContext () {
    const userId = String( this.userId || '' ).trim();
    const tenantId = String( this.tenantId || '' ).trim();

    if ( !userId ) {
      return null;
    }

    return {
      userId,
      tenantId: tenantId || undefined
    };
  }


  get previewMission (): ToddMissionRecord | null {
    return this._previewMission;
  }

  set previewMission ( value: ToddMissionRecord | null ) {
    this._previewMission = value;
    this.refreshDerivedState();
  }

  get activeMission (): ToddMissionRecord | null {
    return this._activeMission;
  }

  set activeMission ( value: ToddMissionRecord | null ) {
    this._activeMission = value;
    this.refreshDerivedState();
  }

  get recentMissions (): ToddMissionRecord[] {
    return this._recentMissions;
  }

  set recentMissions ( value: ToddMissionRecord[] ) {
    this._recentMissions = value;
    this.refreshSectionLinks();
  }

  toggleFocusMode ( enabled: boolean ): void {
    this.focusMode = enabled;
    this.refreshDerivedState();
  }

  hasAuthenticatedUser (): boolean {
    return !!this.userId;
  }

  generatePlan ( formDirective?: NgForm ): void {
    this.missionError = '';
    this.helperCard = null;

    if ( formDirective && formDirective.invalid ) {
      formDirective.control.markAllAsTouched();
      this.missionError = 'Fill in the required mission details before TODD can generate the plan.';
      return;
    }

    const payload = this.buildMissionPayload();
    if ( this.demoModeEnabled ) {
      this.missionError = '';
      this.generatingPlan = true;
      this.previewMission = this.buildDemoMissionRecord( payload );
      this.activeMission = null;
      this.applyNetNewMovesOnApprove = true;
      this.generatingPlan = false;
      this.refreshDerivedState();
      this.clearPendingPreview();
      this.completeGuidedFirstWin();
      this.publishPageContext();
      return;
    }

    this.generatingPlan = true;
    this.goalService.previewToddMissionPlan( payload )
      .pipe( take( 1 ) )
      .subscribe( {
        next: ( response ) => {
          this.previewMission = response?.data || null;
          this.activeMission = null;
          this.applyNetNewMovesOnApprove = true;
          this.generatingPlan = false;
          this.refreshDerivedState();
          this.persistPendingPreview();
          this.completeGuidedFirstWin();
          this.publishPageContext();
        },
        error: ( err ) => {
          this.logger.error( 'Mission plan generation failed', err );
          this.generatingPlan = false;
          this.missionError = err?.error?.message || 'TODD could not generate the mission plan yet.';
        }
      } );
  }

  approveAndCreateMoves (): void {
    if ( !this.previewMission || this.approvingPlan ) return;

    this.missionError = '';
    this.approvingPlan = true;
    this.refreshDerivedState();
    const payload = this.buildMissionPayload();
    if ( this.demoModeEnabled ) {
      if ( !this.previewMission ) return;
      this.missionError = '';
      this.approvingPlan = true;
      this.refreshDerivedState();

      const demoActiveId = 'demo-active-1';
      const moves = ( this.previewMission.plan?.taskPlan || [] ).map( ( task, index ) => ( {
        id: `demo-move-${index + 1}`,
        title: task.title,
        description: task.description || '',
        status: 'not-started',
        priority: task.priority || 'medium',
        phase: task.phase || '',
        route: `/moves-view?projectId=${encodeURIComponent( demoActiveId )}`
      } ) );

      this.activeMission = {
        ...this.previewMission,
        id: demoActiveId,
        status: 'active',
        updatedAt: new Date().toISOString(),
        moves,
        progress: {
          totalCount: moves.length,
          openCount: moves.length,
          completedCount: 0,
          blockedCount: 0,
          inProgressCount: 0,
          completionPercent: 0
        },
        health: {
          totalCount: moves.length,
          openCount: moves.length,
          blockedCount: 0,
          completedCount: 0,
          overdueCount: 0,
          completionPercent: 0,
          currentRiskLevel: 'medium',
          topRisk: this.previewMission.risks?.[0] || ''
        }
      } as ToddMissionRecord;

      this.previewMission = null;
      this.approvingPlan = false;
      this.refreshDerivedState();
      this.clearPendingPreview();
      this.helperCard = {
        title: 'Moves created',
        body: 'TODD created the first Moves for this demo mission and linked them to the workspace.',
        bullets: [
          `Mission status: ${this.formatMissionStatus( this.activeMission?.status )}`,
          `${this.activeMission?.progress?.totalCount || 0} mission Moves are now live.`
        ]
      };
      void this.router.navigate( [], {
        relativeTo: this.route,
        queryParams: { missionId: this.activeMission?.id || null },
        queryParamsHandling: 'merge'
      } );
      this.publishPageContext();
      this.editingMission = false;
      return;
    }

    const request$ = this.activeMission?.id
      ? this.goalService.applyToddMissionRevision( this.activeMission.id, payload, this.applyNetNewMovesOnApprove )
      : this.goalService.createToddMission( payload );

    request$
      .pipe( take( 1 ) )
      .subscribe( {
        next: ( response ) => {
          this.activeMission = response?.data || null;
          this.previewMission = null;
          this.approvingPlan = false;
          this.refreshDerivedState();
          this.clearPendingPreview();
          this.helperCard = {
            title: this.activeMission?.latestRevision ? 'Revision applied' : 'Moves created',
            body: this.activeMission?.latestRevision ?
              ( this.applyNetNewMovesOnApprove ?
                'TODD updated the mission plan and appended only the net-new Moves that were not already in flight.' :
                'TODD updated the mission plan and kept the current Moves intact.' ) :
              'TODD created the first Moves for this mission and linked them to the workspace.',
            bullets: [
              `Mission status: ${this.formatMissionStatus( this.activeMission?.status )}`,
              `${this.activeMission?.progress?.totalCount || 0} mission Moves are now live.`
            ]
          };
          this.loadRecentMissions();
          void this.router.navigate( [], {
            relativeTo: this.route,
            queryParams: { missionId: this.activeMission?.id || null },
            queryParamsHandling: 'merge'
          } );
          this.publishPageContext();
          this.editingMission = false;
        },
        error: ( err ) => {
          this.logger.error( 'Mission approval failed', err );
          this.approvingPlan = false;
          this.refreshDerivedState();
          this.missionError = err?.error?.message || 'TODD could not create the mission Moves yet.';
        }
      } );
  }

  editIntake (): void {
    this.editingMission = true;
    this.helperCard = null;
    this.publishPageContext();
  }

  regeneratePlan (): void {
    this.missionError = '';
    this.helperCard = null;
    const payload = this.buildMissionPayload();
    this.generatingPlan = true;

    if ( this.demoModeEnabled ) {
      this.missionError = '';
      this.helperCard = null;
      this.generatingPlan = true;
      this.previewMission = this.buildDemoMissionRecord( payload );
      this.applyNetNewMovesOnApprove = true;
      this.generatingPlan = false;
      this.refreshDerivedState();
      this.persistPendingPreview();
      this.publishPageContext();
      return;
    }

    const request$ = this.activeMission?.id ?
      this.goalService.previewToddMissionRevision( this.activeMission.id, payload ) :
      this.goalService.previewToddMissionPlan( payload );

    request$
      .pipe( take( 1 ) )
      .subscribe( {
        next: ( response ) => {
          this.previewMission = response?.data || null;
          this.applyNetNewMovesOnApprove = true;
          this.generatingPlan = false;
          this.refreshDerivedState();
          this.persistPendingPreview();
          this.publishPageContext();
        },
        error: ( err ) => {
          this.logger.error( 'Mission revision preview failed', err );
          this.generatingPlan = false;
          this.missionError = err?.error?.message || 'TODD could not compare the revised mission plan yet.';
        }
      } );
  }

  saveMissionChanges (): void {
    if ( !this.activeMission?.id || this.savingMission ) return;

    this.missionError = '';
    this.savingMission = true;
    this.goalService.updateToddMission( this.activeMission.id, this.buildMissionPayload() )
      .pipe( take( 1 ) )
      .subscribe( {
        next: ( response ) => {
          this.activeMission = response?.data || null;
          this.previewMission = null;
          this.savingMission = false;
          this.editingMission = false;
          this.helperCard = {
            title: 'Mission updated',
            body: 'TODD updated the mission details and refreshed the live mission plan.',
            bullets: []
          };
          this.loadRecentMissions();
          this.publishPageContext();
        },
        error: ( err ) => {
          this.logger.error( 'Mission save failed', err );
          this.savingMission = false;
          this.missionError = err?.error?.message || 'TODD could not save the mission changes yet.';
        }
      } );
  }

  completeMission (): void {
    this.changeMissionStatus( 'completed', 'Mission completed' );
  }

  archiveMission (): void {
    this.changeMissionStatus( 'archived', 'Mission archived' );
  }

  openMission ( mission: ToddMissionRecord ): void {
    if ( !mission?.id ) return;
    this.loadMission( mission.id, true );
  }

  recommendNextAction (): void {
    const mission = this.currentMission;
    const nextMove = mission?.plan?.nextRecommendedMove;
    if ( !nextMove ) return;

    this.helperCard = {
      title: 'Next recommended move',
      body: nextMove.description || 'This is the highest-leverage next step TODD sees right now.',
      bullets: [nextMove.label || 'Review the next planned move']
    };
    this.scrollToHelperCard();
  }

  draftStatusUpdate (): void {
    const mission = this.currentMission;
    if ( !mission?.statusUpdateDraft ) return;

    this.helperCard = {
      title: 'Draft status update',
      body: mission.statusUpdateDraft,
      bullets: []
    };
    this.scrollToHelperCard();
  }

  draftStakeholderStatusUpdate (): void {
    const text = this.currentMission?.communicationDrafts?.stakeholderStatusUpdate;
    if ( !text ) return;
    this.helperCard = {
      title: 'Stakeholder status update',
      body: text,
      bullets: []
    };
    this.scrollToHelperCard();
  }

  draftBlockerEscalationUpdate (): void {
    const text = this.currentMission?.communicationDrafts?.blockerEscalationUpdate;
    if ( !text ) return;
    this.helperCard = {
      title: 'Blocker escalation update',
      body: text,
      bullets: []
    };
    this.scrollToHelperCard();
  }

  draftDecisionRequestUpdate (): void {
    const text = this.currentMission?.communicationDrafts?.decisionRequestUpdate;
    if ( !text ) return;
    this.helperCard = {
      title: 'Decision request update',
      body: text,
      bullets: []
    };
    this.scrollToHelperCard();
  }

  draftProgressSummaryNote (): void {
    const text = this.currentMission?.communicationDrafts?.progressSummaryNote;
    if ( !text ) return;
    this.helperCard = {
      title: 'Progress summary note',
      body: text,
      bullets: []
    };
    this.scrollToHelperCard();
  }

  async copyCommunicationDraft ( title: string, body: string ): Promise<void> {
    if ( !body ) return;
    if ( typeof navigator === 'undefined' || !navigator.clipboard?.writeText ) {
      this.notificationService.show( 'Copy unavailable', 'Clipboard access is not available in this browser context.', 'warning' );
      return;
    }

    try {
      await navigator.clipboard.writeText( body );
      this.notificationService.show( 'Copied', `${title} copied to clipboard.`, 'success' );
    } catch ( err ) {
      this.logger.error( 'Mission communication copy failed', err );
      this.notificationService.show( 'Copy failed', 'TODD could not copy that draft yet.', 'error' );
    }
  }

  openCommunicationDraftInComposer ( title: string, body: string ): void {
    if ( !body ) return;
    const missionTitle = String( this.currentMission?.title || 'Mission' ).trim();
    const normalizedTitle = String( title || '' ).trim();
    const subject = normalizedTitle.startsWith( `${missionTitle}:` )
      ? normalizedTitle
      : `${missionTitle}: ${normalizedTitle}`;
    void this.router.navigate( ['/compose-email'], {
      state: {
        subject,
        body
      }
    } );
  }

  openMissionUpdateComposer ( draft: { key: string; title: string; body: string; } ): void {
    this.missionComposer = {
      draftType: draft.key,
      title: `${this.currentMission?.title || 'Mission'}: ${draft.title}`,
      body: draft.body,
      audienceLabel: this.getDefaultAudienceLabel( draft.key )
    };
    this.missionComposerOpen = true;
  }

  closeMissionComposer (): void {
    this.missionComposerOpen = false;
  }

  async copyMissionComposerDraft (): Promise<void> {
    await this.copyCommunicationDraft( this.missionComposer.title, this.missionComposer.body );
  }

  openMissionComposerInEmail (): void {
    this.openCommunicationDraftInComposer( this.missionComposer.title, this.missionComposer.body );
  }

  saveMissionComposerAsNote (): void {
    if ( !this.activeMission?.id ) return;

    const now = new Date().toISOString();
    const nextNotes = [
      {
        id: `mission-note-${Date.now()}`,
        draftType: this.missionComposer.draftType,
        title: this.missionComposer.title.trim(),
        body: this.missionComposer.body.trim(),
        audienceLabel: this.missionComposer.audienceLabel.trim(),
        createdAt: now,
        updatedAt: now
      },
      ...( this.activeMission.communicationNotes || [] )
    ];

    this.goalService.updateToddMission( this.activeMission.id, {
      communicationNotes: nextNotes
    } as Partial<ToddMissionIntake> & { communicationNotes: typeof nextNotes; } )
      .pipe( take( 1 ) )
      .subscribe( {
        next: ( response ) => {
          this.activeMission = response?.data || this.activeMission;
          this.notificationService.show( 'Saved', 'Mission update saved as a note in this mission.', 'success' );
          this.missionComposerOpen = false;
          this.publishPageContext();
        },
        error: ( err ) => {
          this.logger.error( 'Mission note save failed', err );
          this.notificationService.show( 'Save failed', 'TODD could not save that mission note yet.', 'error' );
        }
      } );
  }

  summarizeRisks (): void {
    const risks = this.currentMission?.risks || [];
    this.helperCard = {
      title: 'Current blockers and risks',
      body: risks.length > 0 ?
        'These are the risks TODD wants kept visible while the mission runs.' :
        'No major blockers are surfaced yet, but TODD is still watching the mission for drift.',
      bullets: risks
    };
    this.scrollToHelperCard();
  }

  openMove ( moveId: string ): void {
    if ( !moveId ) return;
    void this.router.navigate( ['/move', moveId] );
  }

  openMissionMovesView (): void {
    const missionId = this.activeMission?.id;
    if ( !missionId ) return;
    void this.router.navigate( ['/moves-view'], {
      queryParams: { projectId: missionId }
    } );
  }

  getRevisionCount ( group: 'unchanged' | 'added' | 'removed' ): number {
    const revision = this.previewMission?.revision;
    if ( !revision ) return 0;

    if ( group === 'unchanged' ) {
      return Number( revision.unchangedTaskCount || 0 );
    }
    if ( group === 'added' ) {
      return Number( revision.newTaskCount || 0 );
    }
    return Number( revision.removedTaskCount || 0 );
  }

  shouldShowRevisionSection ( section: 'new' | 'modified' | 'removed' | 'same' ): boolean {
    const taskChanges = this.previewMission?.revision?.taskChanges;
    if ( !taskChanges ) return false;

    if ( section === 'new' ) return !!taskChanges.added?.length;
    if ( section === 'modified' ) return !!taskChanges.modified?.length;
    if ( section === 'removed' ) return !!taskChanges.removed?.length;
    return !!taskChanges.unchanged?.length;
  }

  async markTaskSuperseded ( moveId: string, taskTitle?: string ): Promise<void> {
    if ( !moveId ) return;
    const supersededAt = new Date().toISOString();
    const supersededReason = `Superseded after mission revision${taskTitle ? `: ${taskTitle}` : ''}`;

    try {
      await this.taskService.updateTask( moveId, {
        superseded: true,
        supersededAt,
        supersededReason,
      }, '' );
      this.updateActiveMissionMove( moveId, {
        superseded: true,
        supersededAt,
        supersededReason,
      } );
      this.helperCard = {
        title: 'Move marked superseded',
        body: 'TODD kept the Move history intact and marked it as no longer part of the active mission plan.',
        bullets: taskTitle ? [taskTitle] : []
      };
    } catch ( err ) {
      this.logger.error( 'Mission supersede failed', err );
      this.missionError = 'TODD could not mark that Move as superseded yet.';
    }
  }

  async updateModifiedMove ( taskChange: {
    after?: { title?: string; description?: string; };
    relatedMoveId?: string;
    relatedMoveTitle?: string;
  } ): Promise<void> {
    const moveId = String( taskChange?.relatedMoveId || '' ).trim();
    if ( !moveId ) return;

    try {
      await this.taskService.updateTask( moveId, {
        title: taskChange?.after?.title || taskChange?.relatedMoveTitle || '',
        description: taskChange?.after?.description || '',
      }, '' );
      this.updateActiveMissionMove( moveId, {
        title: taskChange?.after?.title || taskChange?.relatedMoveTitle || '',
        description: taskChange?.after?.description || '',
      } );
      this.helperCard = {
        title: 'Move updated from revised task',
        body: 'TODD updated the existing Move title and description only because you explicitly approved the change.',
        bullets: [taskChange?.after?.title || taskChange?.relatedMoveTitle || 'Updated move']
      };
    } catch ( err ) {
      this.logger.error( 'Mission move update failed', err );
      this.missionError = 'TODD could not update that Move yet.';
    }
  }

  async createReplacementMove ( taskChange: {
    after?: { title?: string; description?: string; phase?: string; priority?: string; };
    relatedMoveId?: string;
  } ): Promise<void> {
    if ( !this.activeMission?.id ) return;
    const after = taskChange?.after || {};

    try {
      const saved = await this.taskService.addTask( {
        title: after.title || 'Replacement move',
        description: after.description || '',
        dueDate: '',
        progress: 0,
        priority: after.priority || 'medium',
        status: 'not-started',
        projectId: this.activeMission.id,
        taskTypeId: 'todd-mission',
        url: `/moves-view?projectId=${encodeURIComponent( this.activeMission.id )}`
      } as Task, '' );

      this.activeMission = this.activeMission ? {
        ...this.activeMission,
        moves: [...( this.activeMission.moves || [] ), {
          id: String( saved.id || '' ),
          title: saved.title,
          status: saved.status || 'not-started',
          priority: saved.priority || 'medium',
          phase: after.phase || '',
          route: `/moves-view?projectId=${encodeURIComponent( this.activeMission.id )}`,
          superseded: !!saved.superseded,
          supersededAt: saved.supersededAt || '',
          supersededReason: saved.supersededReason || ''
        }]
      } : this.activeMission;
      this.helperCard = {
        title: 'Replacement Move created',
        body: 'TODD added a new Move for the revised task without overwriting the original execution history.',
        bullets: [saved.title]
      };
    } catch ( err ) {
      this.logger.error( 'Mission replacement move failed', err );
      this.missionError = 'TODD could not create the replacement Move yet.';
    }
  }

  trackByMissionId = ( _: number, mission: ToddMissionRecord ) => mission.id;
  trackByMoveId = ( _: number, move: any ) => move.id;

  getSelectedMissionTypeDescription (): string {
    return this.missionTypeOptions.find( option => option.value === this.form.missionType )?.description ||
      '';
  }

  formatMissionType ( missionType: ToddMissionType | string | undefined ): string {
    const option = this.missionTypeOptions.find( item => item.value === missionType );
    return option?.label || 'Mission Outcome';
  }

  formatMissionStatus ( status: string | undefined ): string {
    const normalized = String( status || '' ).trim().toLowerCase();
    if ( normalized === 'draft' ) return 'Draft';
    if ( normalized === 'active' ) return 'Active';
    if ( normalized === 'planned' ) return 'Planned';
    if ( normalized === 'blocked' ) return 'Blocked';
    if ( normalized === 'at_risk' ) return 'At risk';
    if ( normalized === 'completed' ) return 'Completed';
    if ( normalized === 'archived' ) return 'Archived';
    return 'Draft';
  }

  onClickRoute ( route: string ): void {
    if ( !route ) return;
    void this.router.navigateByUrl( route );
  }

  private createDefaultForm (): MissionFormModel {
    return {
      title: '',
      missionType: 'project_delivery_outcome',
      problemStatement: '',
      desiredOutcome: '',
      resourcesText: '',
      stakeholdersText: '',
      constraintsText: '',
      timeline: '',
      successCriteriaText: '',
      companyDescription: '',
      mission: '',
      valueProposition: ''
    };
  }

  private createEmptyComposerDraft (): MissionComposerDraft {
    return {
      draftType: '',
      title: '',
      body: '',
      audienceLabel: ''
    };
  }

  private buildMissionPayload (): ToddMissionIntake {
    return {
      title: this.form.title.trim(),
      missionType: this.form.missionType,
      problemStatement: this.form.problemStatement.trim(),
      desiredOutcome: this.form.desiredOutcome.trim(),
      resources: this.parseList( this.form.resourcesText ),
      stakeholders: this.parseList( this.form.stakeholdersText ),
      constraints: this.parseList( this.form.constraintsText ),
      timeline: this.form.timeline.trim(),
      successCriteria: this.parseList( this.form.successCriteriaText ),
      companyDescription: this.form.companyDescription.trim(),
      mission: this.form.mission.trim(),
      valueProposition: this.form.valueProposition.trim()
    };
  }

  private parseList ( value: string ): string[] {
    return String( value || '' )
      .split( /\n|,/ )
      .map( item => item.trim() )
      .filter( Boolean );
  }

  private joinList ( value?: string[] ): string {
    return Array.isArray( value ) ? value.join( '\n' ) : '';
  }

  private applyMissionToForm ( mission: ToddMissionRecord ): void {
    const intake = mission?.intake;
    if ( !intake ) return;

    this.form = {
      title: intake.title || mission.title || '',
      missionType: intake.missionType || mission.missionType || 'project_delivery_outcome',
      problemStatement: intake.problemStatement || '',
      desiredOutcome: intake.desiredOutcome || '',
      resourcesText: this.joinList( intake.resources ),
      stakeholdersText: this.joinList( intake.stakeholders ),
      constraintsText: this.joinList( intake.constraints ),
      timeline: intake.timeline || '',
      successCriteriaText: this.joinList( intake.successCriteria ),
      companyDescription: intake.companyDescription || '',
      mission: intake.mission || '',
      valueProposition: intake.valueProposition || ''
    };
  }

  private loadRecentMissions (): void {
    this.goalService.listToddMissions()
      .pipe( take( 1 ) )
      .subscribe( {
        next: ( response ) => {
          this.recentMissions = response?.data || [];
          this.publishPageContext();
        },
        error: ( err ) => {
          this.logger.error( 'Mission list load failed', err );
        }
      } );
  }

  private loadMission ( missionId: string, syncRoute: boolean = false ): void {
    this.loading = true;
    this.missionError = '';
    this.goalService.getToddMission( missionId )
      .pipe( take( 1 ) )
      .subscribe( {
        next: ( response ) => {
          this.activeMission = response?.data || null;
          this.previewMission = null;
          if ( this.activeMission ) {
            this.applyMissionToForm( this.activeMission );
          }
          this.editingMission = false;
          this.loading = false;
          this.publishPageContext();
          if ( syncRoute ) {
            void this.router.navigate( [], {
              relativeTo: this.route,
              queryParams: { missionId },
              queryParamsHandling: 'merge'
            } );
          }
        },
        error: ( err ) => {
          this.logger.error( 'Mission load failed', err );
          this.loading = false;
          this.missionError = err?.error?.message || 'TODD could not load that mission yet.';
        }
      } );
  }

  private filterMovesByGroup ( group: 'planned' | 'open' | 'blocked' | 'completed' ) {
    const moves = this.activeMission?.moves || [];
    return moves.filter( move => {
      if ( move.superseded ) {
        return false;
      }
      const status = String( move.status || '' ).toLowerCase();
      if ( group === 'completed' ) return status === 'completed';
      if ( group === 'blocked' ) return status === 'on-hold' || status === 'cancelled' || status === 'blocked';
      if ( group === 'planned' ) return status === 'not-started';
      return status === 'in-progress' || status === 'not-started';
    } );
  }

  private publishPageContext (): void {
    const mission = this.currentMission;
    const hasMissionPreview = this.hasPreview && !this.hasLiveMission;
    const allowedActions = hasMissionPreview ? [
      'generate_mission_plan',
      'approve_mission_plan',
      'review_mission_intake'
    ] : mission ? [
      'recommend_next_action',
      'draft_status_update',
      'draft_stakeholder_update',
      'draft_blocker_escalation',
      'draft_decision_request',
      'draft_progress_summary',
      'summarize_blockers',
      'open_mission_moves',
      'edit_mission',
      'complete_mission',
      'archive_mission'
    ] : [
      'generate_mission_plan',
      'review_mission_intake'
    ];
    const context: AssistantPageContext = {
      feature: 'todd',
      page: 'mission-workspace',
      route: this.router.url,
      mode: mission ? 'dashboard' : 'create',
      title: mission?.title || 'Mission Workspace',
      description: mission ?
        'TODD is operating against a mission plan with moves, risks, and a practical next move.' :
        'Tell TODD the mission, review the plan, and approve the Moves.',
      allowedActions,
      selectedEntityType: 'mission',
      selectedEntityId: mission?.id || '',
      summary: {
        missionType: this.formatMissionType( mission?.missionType || this.form.missionType ),
        missionStatus: this.formatMissionStatus( mission?.status ),
        hasPreview: this.hasPreview,
        hasLiveMission: this.hasLiveMission,
        hasRevisionPreview: this.hasRevisionPreview,
        healthRiskLevel: mission?.health?.currentRiskLevel || '',
        driftLabel: mission?.drift?.label || '',
        totalMoves: mission?.health?.totalCount || mission?.progress?.totalCount || 0,
        openMoves: mission?.health?.openCount || mission?.progress?.openCount || 0,
        completedMoves: mission?.health?.completedCount || mission?.progress?.completedCount || 0,
        blockedMoves: mission?.health?.blockedCount || mission?.progress?.blockedCount || 0,
        overdueMoves: mission?.health?.overdueCount || mission?.progress?.overdueCount || 0,
        revisionCount: mission?.revisions?.length || 0
      },
      dataPreview: {
        problemStatement: mission?.intake?.problemStatement || this.form.problemStatement,
        desiredOutcome: mission?.intake?.desiredOutcome || this.form.desiredOutcome,
        nextRecommendedMove: mission?.plan?.nextRecommendedMove?.label || '',
        risks: mission?.risks || [],
        topRisk: mission?.health?.topRisk || '',
        driftExplanation: mission?.drift?.explanation || '',
        successCriteria: mission?.plan?.successCriteria || [],
        revisionNewTasks: mission?.revision?.newTaskCount || 0,
        revisionChangedTasks: mission?.revision?.changedTaskCount || 0,
        supersededMoves: this.supersededMoves.length,
        missionComposerOpen: this.missionComposerOpen,
        communicationNoteCount: mission?.communicationNotes?.length || 0
      }
    };

    this.assistantBus.setPageContext( context );
  }

  private bindEngagementActions (): void {
    this.engagementActionSubscription = this.assistantBus.engagementActionRequest$.subscribe( request => {
      if ( !request || this.router.url.split( '?' )[0] !== '/plan' ) {
        return;
      }

      switch ( request['action'] ) {
        case 'review_mission_intake':
          document.getElementById( 'mission-intake' )?.scrollIntoView( { behavior: 'smooth', block: 'start' } );
          break;
        case 'generate_mission_plan':
          this.generatePlan();
          break;
        case 'approve_mission_plan':
          this.approveAndCreateMoves();
          break;
        case 'recommend_next_action':
          this.recommendNextAction();
          break;
        case 'draft_status_update':
          this.draftStatusUpdate();
          break;
        case 'draft_stakeholder_update':
          this.draftStakeholderStatusUpdate();
          break;
        case 'draft_blocker_escalation':
          this.draftBlockerEscalationUpdate();
          break;
        case 'draft_decision_request':
          this.draftDecisionRequestUpdate();
          break;
        case 'draft_progress_summary':
          this.draftProgressSummaryNote();
          break;
        case 'summarize_blockers':
          this.summarizeRisks();
          break;
        case 'open_mission_moves':
          if ( this.activeMission?.id ) {
            void this.router.navigate( ['/moves-view'], {
              queryParams: { projectId: this.activeMission.id }
            } );
          }
          break;
        case 'edit_mission':
          this.editIntake();
          break;
        case 'complete_mission':
          this.completeMission();
          break;
        case 'archive_mission':
          this.archiveMission();
          break;
        default:
          break;
      }
    } );
  }

  private refreshSectionLinks (): void {
    this.sectionLinks = this.allSectionLinks.filter( section => {
      if ( section.id === 'mission-recent' ) {
        return this.recentMissions.length > 0;
      }

      if ( section.id === 'mission-plan' ) {
        return !!this.currentMission;
      }

      if ( section.id === 'mission-moves' ) {
        return !!this.activeMission;
      }

      return true;
    } );
  }

  private persistPendingPreview (): void {
    const storageKey = this.getPendingPreviewStorageKey();
    if ( !storageKey || !this.previewMission ) return;

    try {
      window.localStorage.setItem( storageKey, JSON.stringify( {
        version: 1,
        form: this.form,
        previewMission: this.previewMission,
        helperCard: this.helperCard,
        applyNetNewMovesOnApprove: this.applyNetNewMovesOnApprove,
        guidedMode: this.guidedMode
      } ) );
    } catch ( err ) {
      this.logger.error( 'Mission pending preview persist failed', err );
    }
  }

  private tryRestorePendingPreview (): void {
    if ( this.demoModeEnabled ) return;
    if ( this.hydratedPendingPreview ) return;
    if ( typeof window === 'undefined' || !window.localStorage ) return;
    if ( !this.userContextResolved || !this.tenantContextResolved ) return;

    const missionId = String( this.route.snapshot.queryParamMap.get( 'missionId' ) || '' ).trim();
    if ( missionId ) return;

    const storageKey = this.getPendingPreviewStorageKey();
    if ( !storageKey ) return;

    const raw = window.localStorage.getItem( storageKey );
    if ( !raw ) {
      return;
    }

    try {
      const parsed = JSON.parse( raw ) as {
        version?: number;
        form?: MissionFormModel;
        previewMission?: ToddMissionRecord | null;
        helperCard?: MissionHelperCard | null;
        applyNetNewMovesOnApprove?: boolean;
        guidedMode?: 'project' | 'not-sure' | null;
      };

      if ( parsed?.version !== 1 || !parsed.previewMission ) {
        this.clearPendingPreview();
        this.hydratedPendingPreview = true;
        return;
      }

      this.form = parsed.form || this.createDefaultForm();
      this.previewMission = parsed.previewMission;
      this.activeMission = null;
      this.helperCard = parsed.helperCard || null;
      this.applyNetNewMovesOnApprove = parsed.applyNetNewMovesOnApprove ?? true;
      this.guidedMode = parsed.guidedMode || null;
      this.hydratedPendingPreview = true;
      this.publishPageContext();
    } catch ( err ) {
      this.logger.error( 'Mission pending preview restore failed', err );
      this.clearPendingPreview();
      this.hydratedPendingPreview = true;
    }
  }

  private clearPendingPreview (): void {
    const storageKey = this.getPendingPreviewStorageKey();
    if ( !storageKey ) return;

    try {
      window.localStorage.removeItem( storageKey );
    } catch ( err ) {
      this.logger.error( 'Mission pending preview clear failed', err );
    }
  }

  private getPendingPreviewStorageKey (): string | null {
    if ( typeof window === 'undefined' || !window.localStorage ) return null;

    const userId = String( this.userId || '' ).trim();
    if ( !userId ) return null;

    return `${this.pendingPreviewStoragePrefix}:${this.tenantId || 'default'}:${userId}`;
  }

  private scrollToHelperCard (): void {
    setTimeout( () => {
      this.helperCardRef?.nativeElement.scrollIntoView( {
        behavior: 'smooth',
        block: 'start'
      } );
    } );
  }

  private refreshDerivedState (): void {
    this.currentMission = this.previewMission || this.activeMission;
    this.hasPreview = !!this.previewMission && !this.activeMission;
    this.hasLiveMission = !!this.activeMission;
    this.canApprove = !!this.previewMission && !this.approvingPlan;
    this.hasRevisionPreview = !!this.activeMission?.id && !!this.previewMission?.revision;
    this.healthSummary = this.currentMission?.health || this.currentMission?.progress || null;
    this.revisionCount = this.activeMission?.revisions?.length || 0;
    this.lastRevisedAt = this.activeMission?.latestRevision?.createdAt || '';
    this.plannedMoves = this.filterMovesByGroup( 'planned' );
    this.openMoves = this.filterMovesByGroup( 'open' );
    this.blockedMoves = this.filterMovesByGroup( 'blocked' );
    this.completedMoves = this.filterMovesByGroup( 'completed' );
    this.supersededMoves = ( this.activeMission?.moves || [] ).filter( move => !!move.superseded );
    this.currentPhaseLabel = this.computeCurrentPhaseLabel();
    this.visibleMilestones = this.computeVisibleMilestones();
    this.communicationDraftEntries = this.buildCommunicationDraftEntries();
    this.missionCommunicationNotes = this.activeMission?.communicationNotes || [];
    this.refreshSectionLinks();
  }

  private computeCurrentPhaseLabel (): string {
    const mission = this.currentMission;
    const nextMoveLabel = String( mission?.plan?.nextRecommendedMove?.label || '' ).trim().toLowerCase();
    const matchingTask = ( mission?.plan?.taskPlan || [] ).find( task =>
      String( task.title || '' ).trim().toLowerCase() === nextMoveLabel
    );
    const movePhase = ( this.activeMission?.moves || [] )
      .find( move => !move.superseded && String( move.status || '' ).toLowerCase() !== 'completed' )
      ?.phase;
    return String( matchingTask?.phase || movePhase || mission?.plan?.milestones?.[0]?.title || 'Current phase' );
  }

  private computeVisibleMilestones (): Array<{ id?: string; title?: string; objective?: string; deliverables?: string[]; }> {
    const milestones = this.currentMission?.plan?.milestones || [];
    if ( !this.focusMode ) {
      return milestones;
    }

    const phaseLabel = this.currentPhaseLabel.toLowerCase();
    return milestones.filter( milestone =>
      String( milestone.id || '' ).toLowerCase() === phaseLabel ||
      String( milestone.title || '' ).toLowerCase().includes( phaseLabel ) ||
      phaseLabel.includes( String( milestone.id || '' ).toLowerCase() )
    ).slice( 0, 1 );
  }

  private buildCommunicationDraftEntries (): Array<{ key: string; title: string; body: string; }> {
    const drafts = this.currentMission?.communicationDrafts;
    return [
      { key: 'stakeholder', title: 'Stakeholder status update', body: drafts?.stakeholderStatusUpdate || '' },
      { key: 'blocker', title: 'Blocker escalation update', body: drafts?.blockerEscalationUpdate || '' },
      { key: 'decision', title: 'Decision request update', body: drafts?.decisionRequestUpdate || '' },
      { key: 'progress', title: 'Progress summary note', body: drafts?.progressSummaryNote || '' }
    ].filter( item => !!item.body );
  }

  private changeMissionStatus ( status: string, helperTitle: string ): void {
    if ( !this.activeMission?.id || this.updatingMissionStatus ) return;

    this.updatingMissionStatus = true;
    this.goalService.updateToddMissionStatus( this.activeMission.id, status )
      .pipe( take( 1 ) )
      .subscribe( {
        next: ( response ) => {
          this.activeMission = response?.data || null;
          this.updatingMissionStatus = false;
          this.helperCard = {
            title: helperTitle,
            body: `TODD updated the mission lifecycle state to ${this.formatMissionStatus( status )}.`,
            bullets: []
          };
          this.loadRecentMissions();
          this.publishPageContext();
        },
        error: ( err ) => {
          this.logger.error( 'Mission status update failed', err );
          this.updatingMissionStatus = false;
          this.missionError = err?.error?.message || 'TODD could not update the mission status yet.';
        }
      } );
  }

  private updateActiveMissionMove ( moveId: string, changes: Partial<ToddMissionMove> & { description?: string; title?: string; } ): void {
    if ( !this.activeMission?.moves ) return;
    this.activeMission = {
      ...this.activeMission,
      moves: this.activeMission.moves.map( move => String( move.id ) === String( moveId ) ? {
        ...move,
        ...changes
      } : move )
    };
  }

  private getDefaultAudienceLabel ( draftType: string ): string {
    if ( draftType === 'stakeholder' ) return 'Stakeholders';
    if ( draftType === 'blocker' ) return 'Escalation owner';
    if ( draftType === 'decision' ) return 'Decision maker';
    if ( draftType === 'progress' ) return 'Internal team';
    return 'Mission audience';
  }
}
