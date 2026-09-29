import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { MovesAuthService } from '../../services/moves-auth.service';
import {
  MOVE_PRIORITIES, MOVE_WHEN, MovesSignupDraft, MovesSignupDraftService, STARTER_MOVES, StarterMove,
} from '../../services/moves-signup-draft.service';

type StepKey = 'what' | 'when' | 'priority' | 'preview' | 'firstName' | 'lastName' | 'signUp';

interface Step { key: StepKey; section: number; }

/**
 * Pre-sign-in wizard - the web twin of moves-ios's OnboardingWizardView
 * (see ONBOARDING-PROFILE-BILLING-PLAYBOOK.md). One thing per screen under
 * a 4-segment progress bar whose first segment ("Start") is already done:
 * plan a first Move (what, when, how important - one tap each), then name,
 * then sign in. The draft is saved after sign-in by
 * MovesSignupDraftService.submitIfPending() in AuthCallbackComponent.
 * Returning users skip to /login.
 */
@Component( {
  selector: 'app-get-started',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './get-started.component.html',
  styleUrl: './get-started.component.css',
} )
export class GetStartedComponent implements OnInit {
  @ViewChild( 'textInput' ) textInput?: ElementRef<HTMLInputElement>;

  readonly sections = ['Start', 'Your Move', 'About you', 'Sign up'];
  readonly starters = STARTER_MOVES;
  readonly whens = MOVE_WHEN;
  readonly priorities = MOVE_PRIORITIES;
  readonly steps: Step[] = [
    { key: 'what', section: 1 },
    { key: 'when', section: 1 },
    { key: 'priority', section: 1 },
    { key: 'preview', section: 1 },
    { key: 'firstName', section: 2 },
    { key: 'lastName', section: 2 },
    { key: 'signUp', section: 3 },
  ];

  draft!: MovesSignupDraft;
  stepIndex = 0;
  isSigningIn = false;

  constructor (
    private readonly title: Title,
    private readonly authService: MovesAuthService,
    readonly drafts: MovesSignupDraftService,
  ) { }

  ngOnInit (): void {
    this.title.setTitle( 'Get started — Moves | Taliferro Tech' );
    this.draft = this.drafts.load();
  }

  get step (): Step {
    return this.steps[Math.min( this.stepIndex, this.steps.length - 1 )];
  }

  get isOther (): boolean {
    return this.draft.starterKey === 'other';
  }

  get whenLabel (): string {
    return this.whens.find( ( when ) => when.key === this.draft.whenKey )?.label ?? '';
  }

  get priorityLabel (): string {
    return this.priorities.find( ( priority ) => priority.key === this.draft.priority )?.label ?? '';
  }

  get dueDate (): Date {
    return this.drafts.dueDate( this.draft.whenKey );
  }

  sectionFill ( index: number ): number {
    if ( index < this.step.section ) return 1;
    if ( index > this.step.section ) return 0;
    const siblings = this.steps.filter( ( s ) => s.section === index );
    return ( siblings.indexOf( this.step ) + 1 ) / ( siblings.length + 1 );
  }

  get canAdvance (): boolean {
    switch ( this.step.key ) {
      case 'what': return !!this.draft.title.trim();
      case 'firstName': return !!this.draft.firstName.trim();
      case 'lastName': return !!this.draft.lastName.trim();
      default: return true;
    }
  }

  chooseStarter ( starter: StarterMove ): void {
    this.draft.starterKey = starter.key;
    this.draft.title = starter.title;
    this.persist();
    if ( starter.key === 'other' ) this.focus();
  }

  choose ( field: 'whenKey' | 'priority', key: string ): void {
    this.draft[field] = key;
    this.persist();
  }

  next (): void {
    if ( !this.canAdvance || this.stepIndex >= this.steps.length - 1 ) return;
    this.stepIndex++;
    if ( this.step.key === 'signUp' ) this.draft.readyToSubmit = true;
    this.persist();
    this.focus();
  }

  back (): void {
    if ( this.stepIndex > 0 ) this.stepIndex--;
    this.focus();
  }

  persist (): void {
    this.drafts.save( this.draft );
  }

  signIn (): void {
    this.isSigningIn = true;
    this.persist();
    this.authService.signIn( '/app' );
  }

  private focus (): void {
    setTimeout( () => this.textInput?.nativeElement.focus(), 0 );
  }
}
