import { CommonModule } from '@angular/common';
import { Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
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

/** What the template actually binds to - the tone class is precomputed here
 *  so [ngClass] can read a plain field instead of calling a method. */
type RenderedGuidanceCard = MovesGuidanceCard & { toneClass: string };

/**
 * Moves' launcher shell - same from-scratch equivalent of TODD's
 * todd-assistant.component.ts as web-products/network and
 * web-products/pulse's launcher components. See NetworkAssistantLauncherComponent's
 * header comment for the full rationale.
 *
 * Every flow-map screen under /app publishes its page context (FlowRoot ->
 * flow-assistant-context.ts): feature 'moves', page momentum | project |
 * team | todd | digest | review | new-project | my-moves, plus the move open
 * in the drawer as selectedEntity. The guidance card below reads that same
 * summary, so the card, the chat and the screen agree. Pages outside /app
 * (landing, help, pricing) publish nothing and get the orientation card.
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
  private readonly zone = inject( NgZone );

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

  private readonly onDocumentMouseMove = ( event: MouseEvent ): void => {
    if ( this.isInBottomRightHotzone( event.clientX, event.clientY ) && !this.isOverOtherInteractiveElement( event.target ) ) {
      this.revealLauncherTemporarily();
    }
  };

  private readonly onDocumentTouchStart = ( event: TouchEvent ): void => {
    const touch = event.touches?.[0];
    if ( touch && this.isInBottomRightHotzone( touch.clientX, touch.clientY ) && !this.isOverOtherInteractiveElement( event.target ) ) {
      this.revealLauncherTemporarily();
    }
  };

  ngOnInit (): void {
    this.subscriptions.push(
      this.authService.isLoggedIn().subscribe( ( loggedIn ) => { this.isLoggedIn = loggedIn; this.refreshGuidanceCard(); } ),
      this.authService.getUserId().subscribe( ( id ) => ( this.userId = id || null ) ),
      this.authService.getTenantId().subscribe( ( id ) => ( this.tenantId = id || null ) ),
      this.assistantBus.pageContext$.subscribe( ( ctx ) => { this.pageContext = ctx; this.refreshGuidanceCard(); } ),
      this.assistantBus.unread$.subscribe( ( unread ) => ( this.hasUnread = unread ) ),
    );

    // Bound manually (rather than @HostListener) and outside Angular's zone:
    // @HostListener always runs its callback inside the zone, which means
    // zone.js schedules a full app-wide change detection pass after every
    // single mousemove/touchstart anywhere on the page, whether or not the
    // pointer is anywhere near the hotzone. Only re-enter the zone
    // (`this.zone.run`) on the rare occasion the pointer is actually in the
    // hotzone and launcherVisible needs to update.
    if ( typeof document === 'undefined' ) return; // prerendering
    this.zone.runOutsideAngular( () => {
      document.addEventListener( 'mousemove', this.onDocumentMouseMove, { passive: true } );
      document.addEventListener( 'touchstart', this.onDocumentTouchStart, { passive: true } );
    } );
  }

  ngOnDestroy (): void {
    if ( this.launcherHideTimer ) clearTimeout( this.launcherHideTimer );
    this.subscriptions.forEach( ( s ) => s.unsubscribe() );
    if ( typeof document === 'undefined' ) return;
    document.removeEventListener( 'mousemove', this.onDocumentMouseMove );
    document.removeEventListener( 'touchstart', this.onDocumentTouchStart );
  }

  private isInBottomRightHotzone ( clientX: number, clientY: number ): boolean {
    return clientX >= ( window.innerWidth - this.launcherHotzoneSize )
      && clientY >= ( window.innerHeight - this.launcherHotzoneSize );
  }

  /**
   * The hotzone is a broad 180x180 proximity area, not just the pill's own
   * footprint - on narrower viewports a page's own bottom-right-anchored
   * button can fall inside it. Revealing the pill there put it, at a higher
   * z-index, physically on top of that button for the rest of the same
   * synthetic event sequence, so a click meant for the page's button could
   * land on the pill instead. Skip the reveal whenever the pointer/touch is
   * already on top of some other clickable element.
   */
  private isOverOtherInteractiveElement ( target: EventTarget | null ): boolean {
    if ( !( target instanceof Element ) ) return false;
    if ( target.closest( '.todd-assistant-root' ) ) return false;
    return !!target.closest( 'button, a, input, select, textarea, [role="button"]' );
  }

  private revealLauncherTemporarily (): void {
    this.zone.run( () => {
      this.launcherVisible = true;
      if ( this.launcherHideTimer ) clearTimeout( this.launcherHideTimer );

      if ( this.showAssistant ) return;

      this.launcherHideTimer = setTimeout( () => {
        if ( !this.showAssistant ) this.launcherVisible = false;
      }, this.launcherRevealDurationMs );
    } );
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

  guidanceCard: RenderedGuidanceCard | null = null;

  private refreshGuidanceCard (): void {
    const sample = this.pageContext?.summary?.['isSample'] === true;
    // Signed out on the sample team: the page card, with a sign-in nudge.
    const card = this.isLoggedIn || sample ? this.computeGuidanceCard( this.pageContext ) : this.guestOrientationCard;
    const withSample = card && sample ? { ...card, bullets: [...card.bullets, 'This is a sample team. Sign in to see your own projects.'] } : card;
    this.guidanceCard = withSample ? { ...withSample, toneClass: `todd-activation-card--${withSample.tone}` } : this.isLoggedIn ? null : { ...this.guestOrientationCard, toneClass: 'todd-activation-card--neutral' };
  }

  private get guestOrientationCard (): MovesGuidanceCard {
    return {
      eyebrow: 'WHAT IS MOVES',
      stageLabel: 'Overview',
      tone: 'neutral',
      icon: 'fa-solid fa-compass',
      title: 'Every project as a line against today',
      message: 'Moves shows a project lead where work is about to stall - no owner, no next action, gone quiet, or out of order - and 16Ahead fixes the small things within rules you set.',
      whyItMatters: 'Work rarely fails because nobody wrote it down. It fails because it goes still and nobody notices.',
      bullets: [
        'Open the app to look around a sample team.',
        'Paste a plan you already have and 16Ahead checks it before anyone starts.',
        'Ask this chat how Moves works, or what 16Ahead does on its own.',
      ],
    };
  }

  private computeGuidanceCard ( ctx: MovesAssistantPageContext | null ): MovesGuidanceCard | null {
    if ( !ctx || String( ctx.feature || '' ).toLowerCase() !== 'moves' ) return null;
    const summary = ctx.summary || {};
    const preview = ctx.dataPreview || {};
    if ( ctx.selectedEntityType === 'move' && preview['move'] ) return this.moveCard( preview['move'] );

    const needs = Number( summary['needsYouCount'] || 0 );
    const first = ( summary['needsYou'] as { title: string; project: string }[] | undefined )?.[0];
    const todd = String( summary['todd'] || 'on' );
    const toddLine = todd === 'dry_run' ? '16Ahead is practising: it logs what it would do and changes nothing.' : todd === 'off' ? '16Ahead is paused: it flags breaks but won’t act.' : '';
    const fixed = Number( summary['toddFixedToday'] || 0 );

    switch ( String( ctx.page || '' ) ) {
      case 'momentum':
      case 'digest':
        if ( Number( summary['projectCount'] || 0 ) === 0 ) {
          return { eyebrow: 'MOMENTUM', stageLabel: 'No projects yet', tone: 'attention', icon: 'fa-solid fa-triangle-exclamation', title: 'Start your first project', message: 'Paste a plan you already have. 16Ahead turns it into a line and checks the order, owners and next actions.', whyItMatters: '16Ahead can only watch work that’s on a line.', bullets: [] };
        }
        return needs ? {
          eyebrow: 'MOMENTUM', stageLabel: 'Needs you', tone: 'attention', icon: 'fa-solid fa-triangle-exclamation',
          title: `${needs} thing${needs === 1 ? '' : 's'} need${needs === 1 ? 's' : ''} you`,
          message: first ? `Start with ${first.project ? first.project + ': ' : ''}${first.title}. Or run the review to decide them one at a time.` : 'Run the review to decide them one at a time.',
          whyItMatters: 'These are the breaks 16Ahead can’t fix inside its rules.',
          bullets: [fixed ? `16Ahead fixed ${fixed} smaller thing${fixed === 1 ? '' : 's'} today - each has Undo.` : '', toddLine].filter( Boolean ),
        } : {
          eyebrow: 'MOMENTUM', stageLabel: 'Moving', tone: 'ready', icon: 'fa-solid fa-circle-check',
          title: 'Every line is moving', message: 'Nothing needs you right now. 16Ahead will flag the next break in the margin.',
          whyItMatters: 'A clean board stays clean when every move keeps an owner and a next action.',
          bullets: [fixed ? `16Ahead fixed ${fixed} smaller thing${fixed === 1 ? '' : 's'} today.` : '', toddLine].filter( Boolean ),
        };
      case 'project': {
        const diagnosis = ( preview['diagnosis'] as { status: string; title: string }[] | undefined ) || [];
        const urgent = diagnosis.filter( d => d.status === 'needs_you' );
        return urgent.length ? {
          eyebrow: String( summary['project'] || 'PROJECT' ).toUpperCase(), stageLabel: String( summary['health'] || 'Needs a look' ), tone: 'attention', icon: 'fa-solid fa-triangle-exclamation',
          title: urgent[0].title, message: `Forecast: ${summary['forecast'] || 'unknown'}. Diagnosis on the right has the fix.`,
          whyItMatters: 'The critical path is where a break costs the ship date.',
          bullets: [`${summary['nextActionsSet'] || ''} next actions set.`, ...urgent.slice( 1, 3 ).map( d => d.title )].filter( b => b.trim() !== 'next actions set.' ),
        } : {
          eyebrow: String( summary['project'] || 'PROJECT' ).toUpperCase(), stageLabel: 'Moving', tone: 'ready', icon: 'fa-solid fa-circle-check',
          title: `${summary['forecast'] || 'On track'}`, message: 'Nothing here needs you. Sequence shows the order; People shows who has room.',
          whyItMatters: 'Every move with an owner and a next action is one 16Ahead can keep moving.', bullets: [],
        };
      }
      case 'team': {
        const over = ( summary['overCapacity'] as string[] | undefined ) || [];
        const noOwner = Number( summary['noOwnerCount'] || 0 );
        return over.length || noOwner ? {
          eyebrow: 'TEAM', stageLabel: 'Uneven load', tone: 'attention', icon: 'fa-solid fa-triangle-exclamation',
          title: over.length ? `${over[0]}${over.length > 1 ? ` and ${over.length - 1} more` : ''} over capacity` : `${noOwner} move${noOwner === 1 ? '' : 's'} with no owner`,
          message: '16Ahead hands work to whoever on the project has the most room. Set each person’s capacity on a project’s People tab.',
          whyItMatters: 'An overloaded owner is the most common reason a move goes still.', bullets: [],
        } : { eyebrow: 'TEAM', stageLabel: 'Balanced', tone: 'ready', icon: 'fa-solid fa-circle-check', title: 'Everyone has room', message: 'Nobody is over capacity for the next two weeks.', whyItMatters: 'Room on the team is what lets 16Ahead hand off without asking.', bullets: [] };
      }
      case 'todd':
        return {
          eyebrow: 'TODD', stageLabel: todd === 'dry_run' ? 'Practising' : todd === 'off' ? 'Paused' : 'On', tone: todd === 'on' ? 'ready' : 'progress', icon: 'fa-solid fa-robot',
          title: todd === 'dry_run' ? '16Ahead is practising' : todd === 'off' ? '16Ahead is paused' : '16Ahead is acting within its rules',
          message: todd === 'dry_run' ? '“Would have” entries in the log show what it would do. Turn it on when they look right.' : 'Everything it did is in the log with Undo. Turn a rule off to keep that decision for yourself.',
          whyItMatters: 'Two rules are locked: never move a client-facing or hand-set date, never message anyone outside the team.',
          bullets: needs ? [`${needs} thing${needs === 1 ? '' : 's'} need${needs === 1 ? 's' : ''} you at the top of this page.`] : [],
        };
      case 'review':
        return { eyebrow: 'WEEKLY REVIEW', stageLabel: `${needs} left`, tone: needs ? 'progress' : 'ready', icon: 'fa-solid fa-list-check', title: needs ? `${needs} decision${needs === 1 ? '' : 's'} to make` : 'Nothing to decide', message: 'Press 1–4 to choose. 16Ahead’s suggestion is always first.', whyItMatters: 'Only what 16Ahead can’t fix lands here, so this list stays short.', bullets: ['Share to standup copies the list for your team channel.'] };
      case 'new-project':
        return { eyebrow: 'NEW PROJECT', stageLabel: 'Plan', tone: 'neutral', icon: 'fa-solid fa-compass', title: 'Paste the plan you already have', message: 'A list, a doc or meeting notes. 16Ahead draws it as a line and checks the order, owners and next actions.', whyItMatters: 'Fixing a wrong order or a missing owner now is free; fixing it mid-project costs a date.', bullets: ['Content work (emails, posts, images) can go to the Marketing Assistant.'] };
      case 'my-moves': {
        const mine = Number( summary['myOpenMoves'] || 0 );
        return { eyebrow: 'MY MOVES', stageLabel: `${mine} open`, tone: 'neutral', icon: 'fa-solid fa-list-check', title: mine ? `${mine} next move${mine === 1 ? '' : 's'}` : 'Nothing on your plate', message: 'Done when it’s done. Can’t do it sends it back to 16Ahead, which finds someone else.', whyItMatters: 'Saying “can’t” early is what keeps a line from stalling.', bullets: [] };
      }
      default:
        return null;
    }
  }

  private moveCard ( m: Record<string, any> ): MovesGuidanceCard {
    const issues = ( m['issues'] as { title: string; explanation: string }[] | undefined ) || [];
    if ( issues.length ) {
      return {
        eyebrow: 'MOVE', stageLabel: 'Needs a look', tone: 'attention', icon: 'fa-solid fa-triangle-exclamation',
        title: issues[0].title, message: issues[0].explanation,
        whyItMatters: m['blocks']?.length ? `${m['blocks'].length} move${m['blocks'].length === 1 ? ' waits' : 's wait'} on this one.` : 'A move with an owner and a next action is one 16Ahead can keep moving.',
        bullets: [`Owner: ${m['owner']}`, `Due ${m['due']}`],
      };
    }
    return {
      eyebrow: 'MOVE', stageLabel: m['done'] ? 'Done' : 'Moving', tone: m['done'] ? 'ready' : 'neutral', icon: 'fa-solid fa-circle-check',
      title: String( m['title'] || 'This move' ), message: `Next: ${m['nextAction']}`,
      whyItMatters: 'Ask the General Assistant to draft a note for the owner, or what to do if this slips.',
      bullets: [`Owner: ${m['owner']}`, `Due ${m['due']}`],
    };
  }
}
