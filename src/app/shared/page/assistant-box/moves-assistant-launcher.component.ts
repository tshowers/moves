import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AssistantBoxComponent } from './assistant-box.component';
import { MovesAuthService } from '../../../services/moves-auth.service';
import { MovesAssistantPageContext, MovesAssistantSignalService } from '../../../services/moves-assistant-signal.service';

type GuidanceTone = 'neutral' | 'progress' | 'attention' | 'ready';

interface MovesGuidanceCard {
  eyebrow: string;
  title: string;
  message: string;
  whyItMatters: string;
  bullets: string[];
  stageLabel: string;
  tone: GuidanceTone;
  icon: string;
  nextStage?: string;
}

/**
 * Moves' launcher shell - same from-scratch equivalent of TODD's
 * todd-assistant.component.ts as web-products/network and
 * web-products/pulse's launcher components. See NetworkAssistantLauncherComponent's
 * header comment for the full rationale.
 *
 * Covers four pages that already publish rich page context:
 * task-home (feature 'moves', page 'task-home'), task-edit ('task-edit'),
 * task-view-parent ('moves-view'), and mission-workspace - which publishes
 * under feature 'todd', page 'mission-workspace' (not 'moves'), since it's
 * TODD's own Mission Workspace feature (Goal Engine mission planning,
 * already scoped down to just that slice via GoalApiService - see that
 * file's own header comment) rather than a plain Moves page.
 */
@Component( {
  selector: 'app-moves-assistant-launcher',
  standalone: true,
  imports: [CommonModule, AssistantBoxComponent],
  templateUrl: './moves-assistant-launcher.component.html',
  styleUrls: ['./moves-assistant-launcher.component.css'],
} )
export class MovesAssistantLauncherComponent implements OnInit, OnDestroy {
  private readonly authService = inject( MovesAuthService );
  private readonly assistantBus = inject( MovesAssistantSignalService );
  private readonly router = inject( Router );

  private readonly launcherHotzoneSize = 180;
  private readonly launcherRevealDurationMs = 2400;
  private launcherHideTimer: ReturnType<typeof setTimeout> | null = null;

  showAssistant = false;
  launcherVisible = false;
  hasUnread = false;
  pageContext: MovesAssistantPageContext | null = null;
  isLoggedIn = false;

  userId: string | null = null;
  tenantId: string | null = null;

  private readonly subscriptions: Subscription[] = [];

  ngOnInit (): void {
    this.subscriptions.push(
      this.authService.isLoggedIn().subscribe( ( loggedIn ) => ( this.isLoggedIn = loggedIn ) ),
      this.authService.getUserId().subscribe( ( id ) => ( this.userId = id || null ) ),
      this.authService.getTenantId().subscribe( ( id ) => ( this.tenantId = id || null ) ),
      this.assistantBus.pageContext$.subscribe( ( ctx ) => ( this.pageContext = ctx ) ),
      this.assistantBus.unread$.subscribe( ( unread ) => ( this.hasUnread = unread ) ),
    );
  }

  ngOnDestroy (): void {
    if ( this.launcherHideTimer ) clearTimeout( this.launcherHideTimer );
    this.subscriptions.forEach( ( s ) => s.unsubscribe() );
  }

  @HostListener( 'document:mousemove', ['$event'] )
  onMouseMove ( event: MouseEvent ): void {
    if ( this.isInBottomRightHotzone( event.clientX, event.clientY ) ) {
      this.revealLauncherTemporarily();
    }
  }

  @HostListener( 'document:touchstart', ['$event'] )
  onTouchStart ( event: TouchEvent ): void {
    const touch = event.touches?.[0];
    if ( touch && this.isInBottomRightHotzone( touch.clientX, touch.clientY ) ) {
      this.revealLauncherTemporarily();
    }
  }

  private isInBottomRightHotzone ( clientX: number, clientY: number ): boolean {
    return clientX >= ( window.innerWidth - this.launcherHotzoneSize )
      && clientY >= ( window.innerHeight - this.launcherHotzoneSize );
  }

  private revealLauncherTemporarily (): void {
    this.launcherVisible = true;
    if ( this.launcherHideTimer ) clearTimeout( this.launcherHideTimer );

    if ( this.showAssistant ) return;

    this.launcherHideTimer = setTimeout( () => {
      if ( !this.showAssistant ) this.launcherVisible = false;
    }, this.launcherRevealDurationMs );
  }

  toggleAssistant (): void {
    this.showAssistant = !this.showAssistant;
    if ( this.showAssistant ) {
      this.launcherVisible = true;
      if ( this.launcherHideTimer ) clearTimeout( this.launcherHideTimer );
      this.assistantBus.clearAssistantUnread();
    }
  }

  dismissAssistant (): void {
    this.showAssistant = false;
    this.launcherVisible = false;
  }

  onAssistantNavigate ( target: { path: string; queryParams?: any; fragment?: string; } ): void {
    if ( !target?.path ) return;
    void this.router.navigate( [target.path], { queryParams: target.queryParams, fragment: target.fragment } );
  }

  get guidanceCard (): MovesGuidanceCard | null {
    if ( !this.isLoggedIn ) return this.guestOrientationCard;
    return this.computeGuidanceCard( this.pageContext );
  }

  private get guestOrientationCard (): MovesGuidanceCard {
    return {
      eyebrow: 'WHAT IS THIS PAGE',
      stageLabel: 'Overview',
      tone: 'neutral',
      icon: 'fa-solid fa-compass',
      title: 'Moves turns work into tracked execution',
      message: 'TODD watches your moves for pressure, blockers, and flow so nothing important slips silently. Sign in to see it work with your own data.',
      whyItMatters: "A to-do list doesn't tell you what's actually at risk - Moves is what turns tasks into a system TODD can watch.",
      bullets: [
        'Create a Move to start tracking a piece of work.',
        'TODD flags overdue or stale moves before they slip further.',
        'Ask this chat how Moves works, or what TODD actually does.',
      ],
    };
  }

  private computeGuidanceCard ( ctx: MovesAssistantPageContext | null ): MovesGuidanceCard | null {
    if ( !ctx ) return null;

    const feature = String( ctx.feature || '' ).toLowerCase();
    const page = String( ctx.page || '' ).toLowerCase();

    if ( feature === 'moves' ) {
      switch ( page ) {
        case 'task-home': return this.taskHomeCard( ctx );
        case 'task-edit': return this.taskEditCard( ctx );
        case 'moves-view': return this.movesViewCard( ctx );
        default: return null;
      }
    }

    if ( feature === 'todd' && page === 'mission-workspace' ) {
      return this.missionWorkspaceCard( ctx );
    }

    return null;
  }

  private taskHomeCard ( ctx: MovesAssistantPageContext ): MovesGuidanceCard {
    const summary = ctx.summary || {};
    const total = Number( summary['totalMoveCount'] || 0 );
    const overdue = Number( summary['overdueMoveCount'] || 0 );
    const onHold = Number( summary['onHoldMoveCount'] || 0 );
    const executionScore = Number( summary['executionScore'] || 0 );

    if ( total === 0 ) {
      return {
        eyebrow: 'GETTING STARTED',
        stageLabel: 'No moves yet',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: 'Create your first Move',
        message: "TODD doesn't see any moves yet. Add one to start tracking execution.",
        whyItMatters: 'Execution only has something to watch once there’s work tracked here.',
        bullets: [],
      };
    }

    if ( overdue > 0 ) {
      return {
        eyebrow: 'EXECUTION',
        stageLabel: 'Overdue',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: `${overdue} move${overdue === 1 ? ' is' : 's are'} overdue`,
        message: 'Review overdue moves in the Moves Browser and either reschedule or close them out.',
        whyItMatters: 'Overdue work is the clearest signal something is actually stuck, not just busy.',
        bullets: [`${total.toLocaleString()} total moves tracked.`],
      };
    }

    if ( onHold > 0 ) {
      return {
        eyebrow: 'EXECUTION',
        stageLabel: 'On hold',
        tone: 'progress',
        icon: 'fa-solid fa-hourglass-half',
        title: `${onHold} move${onHold === 1 ? '' : 's'} on hold`,
        message: 'On-hold moves don’t show up as overdue, but they’re not moving either. Worth a check-in.',
        whyItMatters: 'On-hold work can silently stall a mission if nobody revisits it.',
        bullets: [],
      };
    }

    return {
      eyebrow: 'EXECUTION',
      stageLabel: executionScore >= 70 ? 'Healthy' : executionScore >= 40 ? 'Mixed' : 'Watch',
      tone: executionScore >= 70 ? 'ready' : executionScore >= 40 ? 'progress' : 'attention',
      icon: executionScore >= 70 ? 'fa-solid fa-circle-check' : 'fa-solid fa-hourglass-half',
      title: `Execution score: ${executionScore}`,
      message: `${total.toLocaleString()} moves tracked, nothing overdue right now. Review the panel for pressure and flow.`,
      whyItMatters: 'A clean execution score only holds if new moves keep getting picked up as they land.',
      bullets: [],
    };
  }

  private taskEditCard ( ctx: MovesAssistantPageContext ): MovesGuidanceCard {
    const summary = ctx.summary || {};
    const isSubTask = summary['isSubTask'] === true;
    const hasTitle = summary['hasTitle'] === true;
    const selectedContactCount = Number( summary['selectedContactCount'] || 0 );

    if ( !hasTitle ) {
      return {
        eyebrow: isSubTask ? 'SUB-MOVE' : ( ctx.mode === 'edit' ? 'EDIT MOVE' : 'CREATE MOVE' ),
        stageLabel: 'Getting started',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: 'Give this Move a title',
        message: 'A clear title is what shows up on the board and in search - describe the actual action, not just the topic.',
        whyItMatters: 'Vague titles are the #1 reason a move goes stale - nobody remembers what "follow up" meant.',
        bullets: [],
      };
    }

    return {
      eyebrow: isSubTask ? 'SUB-MOVE' : ( ctx.mode === 'edit' ? 'EDIT MOVE' : 'CREATE MOVE' ),
      stageLabel: 'Ready',
      tone: 'ready',
      icon: 'fa-solid fa-circle-check',
      title: 'This Move is ready to save',
      message: selectedContactCount > 0
        ? `Connected to ${selectedContactCount} contact${selectedContactCount === 1 ? '' : 's'}. Save when ready.`
        : 'Consider connecting a contact if this move is tied to a relationship.',
      whyItMatters: 'Connecting contacts and projects is what lets TODD surface this move from more than one place.',
      bullets: [],
    };
  }

  private movesViewCard ( ctx: MovesAssistantPageContext ): MovesGuidanceCard {
    const summary = ctx.summary || {};
    const totalMoves = Number( summary['totalMoves'] || 0 );
    const overdueMoves = Number( summary['overdueMoves'] || 0 );
    const staleMoves = Number( summary['staleMoves'] || 0 );
    const disconnectedMoves = Number( summary['disconnectedMoves'] || 0 );

    if ( totalMoves === 0 ) {
      return {
        eyebrow: 'MOVES BROWSER',
        stageLabel: 'Empty',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: 'No moves to show',
        message: 'Create a move to see it listed here.',
        whyItMatters: 'This is where you filter, sort, and open every move you’re tracking.',
        bullets: [],
      };
    }

    if ( overdueMoves > 0 || staleMoves > 0 ) {
      return {
        eyebrow: 'MOVES BROWSER',
        stageLabel: 'Needs attention',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: `${overdueMoves + staleMoves} move${( overdueMoves + staleMoves ) === 1 ? '' : 's'} overdue or stale`,
        message: 'Filter to overdue or stale to see exactly which ones, then reschedule or close them out.',
        whyItMatters: 'Stale moves (no update in a while) are often as much of a problem as overdue ones - they’re just quieter about it.',
        bullets: [`${totalMoves.toLocaleString()} total moves in view.`],
      };
    }

    if ( disconnectedMoves > 0 ) {
      return {
        eyebrow: 'MOVES BROWSER',
        stageLabel: 'Disconnected moves',
        tone: 'progress',
        icon: 'fa-solid fa-hourglass-half',
        title: `${disconnectedMoves} move${disconnectedMoves === 1 ? '' : 's'} not linked to a mission`,
        message: 'These moves aren’t tied to a Mission Workspace plan. Not required, but worth checking if they belong to a larger outcome.',
        whyItMatters: 'Mission-linked moves get tracked against a bigger goal; standalone ones only show up here.',
        bullets: [],
      };
    }

    return {
      eyebrow: 'MOVES BROWSER',
      stageLabel: 'Healthy',
      tone: 'ready',
      icon: 'fa-solid fa-circle-check',
      title: `${totalMoves.toLocaleString()} moves, all current`,
      message: 'Nothing overdue or stale right now. Use the filters to narrow by view, or click any move to open it.',
      whyItMatters: 'Staying current is what keeps the Execution score on task-home meaningful.',
      bullets: [],
    };
  }

  private missionWorkspaceCard ( ctx: MovesAssistantPageContext ): MovesGuidanceCard {
    const summary = ctx.summary || {};
    const hasLiveMission = summary['hasLiveMission'] === true;
    const hasPreview = summary['hasPreview'] === true;
    const totalMoves = Number( summary['totalMoves'] || 0 );
    const blockedMoves = Number( summary['blockedMoves'] || 0 );
    const overdueMoves = Number( summary['overdueMoves'] || 0 );
    const riskLevel = String( summary['healthRiskLevel'] || '' ).toLowerCase();

    if ( !hasLiveMission && !hasPreview ) {
      return {
        eyebrow: 'MISSION WORKSPACE',
        stageLabel: 'New mission',
        tone: 'neutral',
        icon: 'fa-solid fa-compass',
        title: 'Describe the outcome you’re after',
        message: 'Tell TODD the mission and the desired outcome - it will draft a plan of moves for you to review before anything is created.',
        whyItMatters: 'A mission plan only helps if it starts from a real, specific outcome - not just a task list.',
        bullets: [],
      };
    }

    if ( hasPreview && !hasLiveMission ) {
      return {
        eyebrow: 'MISSION WORKSPACE',
        stageLabel: 'Plan ready',
        tone: 'progress',
        icon: 'fa-solid fa-hourglass-half',
        title: 'A plan is ready for review',
        message: 'TODD drafted a set of moves for this mission. Review them and approve to turn the plan into real Moves.',
        whyItMatters: 'Nothing is created until you approve - this is the checkpoint before it becomes real tracked work.',
        bullets: [],
      };
    }

    if ( blockedMoves > 0 || overdueMoves > 0 || riskLevel === 'high' ) {
      return {
        eyebrow: 'MISSION WORKSPACE',
        stageLabel: 'At risk',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: 'This mission needs attention',
        message: `${blockedMoves} blocked, ${overdueMoves} overdue out of ${totalMoves} moves. Ask TODD to recommend the next action or draft a blocker escalation.`,
        whyItMatters: 'A mission’s health is only as good as its slowest-moving blocker.',
        bullets: [],
      };
    }

    return {
      eyebrow: 'MISSION WORKSPACE',
      stageLabel: 'On track',
      tone: 'ready',
      icon: 'fa-solid fa-circle-check',
      title: `${totalMoves.toLocaleString()} moves, on track`,
      message: 'Ask TODD to recommend the next action, or draft a status update to share progress.',
      whyItMatters: 'Regular status updates are what keep a mission visible to everyone who needs to see it.',
      bullets: [],
    };
  }

  guidanceToneClass ( tone: GuidanceTone ): string {
    return `todd-activation-card--${tone}`;
  }
}
