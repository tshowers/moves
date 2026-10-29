import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { daysBetween, fmtDay, fmtTime } from '../flow-dates';
import { byRoom, choiceLabel } from '../flow-engine';
import { Issue, IssueChoice, ToddAction } from '../flow.models';
import { FlowStore } from '../flow.store';
import { PersonPickerComponent } from './flow-ui.components';

export const KIND_LABEL: Record<string, string> = { gap: 'Gap', stall: 'Stall', order: 'Order', pileup: 'Pile-up', capacity: 'Capacity' };
const STATUS_LABEL: Record<string, string> = { needs_you: 'needs you', watching: 'watching', fixed: 'fixed' };

/** A Diagnosis card: type tag + status, title, TODD's explanation in the first person, actions. */
@Component( {
  selector: 'mv-issue-card',
  standalone: true,
  imports: [PersonPickerComponent, RouterLink],
  template: `
    @let i = issue();
    <article class="mv-card ic" [class.fixed]="i.status === 'fixed'" [class.raised]="i.status === 'needs_you'">
      <span class="mv-tag" [class.mv-tag--pink]="i.status === 'needs_you'" [class.mv-tag--green]="i.status === 'fixed'">{{ kind() }} · {{ status() }}</span>
      <h3>{{ i.title }}</h3>
      <p>{{ i.explanation }}
        @if (action(); as a) { <button type="button" class="mv-link" (click)="store.undo(a.id)">Undo</button> }
      </p>
      @if (i.status === 'needs_you') {
        <div class="actions">
          @if (i.kind === 'order') {
            <a class="mv-btn mv-btn--primary" [routerLink]="['/app/projects', i.projectId, 'sequence']">See fix</a>
          } @else if (i.choices[0]) {
            <button type="button" class="mv-btn mv-btn--primary" (click)="run(i.choices[0])">{{ label(i.choices[0]) }}</button>
          }
          @if (canPick()) {
            <span class="pick-wrap">
              <button type="button" class="mv-btn" (click)="picking.set(!picking())">Pick</button>
              @if (picking()) { <mv-person-picker [people]="people()" (picked)="pick($event)" (closed)="picking.set(false)" /> }
            </span>
          } @else if (i.choices[1] && i.kind !== 'order') {
            <button type="button" class="mv-btn" (click)="run(i.choices[1])">{{ label(i.choices[1]) }}</button>
          }
        </div>
      }
    </article>
  `,
  styles: [`
    .ic { border-radius: 24px; padding: 16px 18px; border-color: transparent; }
    .ic.raised { box-shadow: var(--shadow-sm); border: 1px solid var(--surface2); }
    .ic.fixed { border: 1.5px dashed var(--n500); background: transparent; }
    h3 { font-size: 16px; margin-top: 10px !important; }
    p { font-size: 13px; color: var(--text2); margin-top: 6px !important; line-height: 1.45; }
    p .mv-link { font-size: 13px; }
    .actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    .actions a { text-decoration: none; color: #fff; }
    .pick-wrap { position: relative; }
  `],
} )
export class IssueCardComponent {
  readonly store = inject( FlowStore );
  private readonly router = inject( Router );
  readonly issue = input.required<Issue>();
  readonly picking = signal( false );

  readonly kind = computed( () => KIND_LABEL[this.issue().kind] );
  readonly status = computed( () => STATUS_LABEL[this.issue().status] );
  readonly canPick = computed( () => this.issue().choices[0]?.run.kind === 'assign' && this.issue().kind === 'gap' );
  readonly people = computed( () => byRoom( this.store.state(), this.issue().projectId ) );
  /** For fixed cards: the TODD action to undo. */
  readonly action = computed<ToddAction | undefined>( () => {
    const i = this.issue();
    if ( !i.id.startsWith( 'fixed:' ) ) return undefined;
    return this.store.state().actions.find( a => a.id === i.id.slice( 6 ) );
  } );

  label ( c: IssueChoice ): string {
    return choiceLabel( c );
  }

  run ( c: IssueChoice ): void {
    if ( c.run.kind === 'open' ) void this.router.navigate( [], { queryParams: { move: c.run.moveId }, queryParamsHandling: 'merge' } );
    else this.store.run( c, this.issue() );
  }

  pick ( personId: string ): void {
    this.picking.set( false );
    this.store.assign( this.issue().moveIds[0], personId );
  }
}

/** The TODD log: tag | what happened | project | time | Undo. */
@Component( {
  selector: 'mv-log-rows',
  standalone: true,
  template: `
    @for (a of actions(); track a.id) {
      <div class="lr" [class.undone]="!!a.undoneAt" [class.dry]="a.dryRun">
        <span class="mv-tag tag" [class]="'mv-tag tag tag--' + (a.dryRun ? 'dry' : a.type)">{{ a.dryRun ? 'Would have' : typeLabel(a) }}</span>
        <p><strong>{{ a.subject }}</strong> {{ a.text }}</p>
        @if (showProject()) { <span class="proj">{{ projectName(a.projectId) }}</span> }
        <span class="time">{{ time(a) }}</span>
        @if (a.dryRun) { <span class="undo muted">Practice</span> }
        @else if (a.undoneAt) { <span class="undo muted">Undone</span> }
        @else if (a.changes.length) { <button type="button" class="mv-link undo" (click)="store.undo(a.id)">Undo</button> }
        @else { <span class="undo"></span> }
      </div>
    } @empty {
      <p class="mv-empty">Nothing yet. 16Ahead logs every change here, with Undo.</p>
    }
  `,
  styles: [`
    .lr { display: grid; grid-template-columns: 92px minmax(0, 1fr) 150px 56px 48px; gap: 12px; align-items: center; padding: 12px 4px; border-bottom: 1px solid var(--surface2); }
    :host(.no-project) .lr { grid-template-columns: 92px minmax(0, 1fr) 56px 48px; }
    .lr.undone p { text-decoration: line-through; color: var(--muted); }
    .tag { justify-content: center; font-size: 11px; padding: 3px 6px; }
    .tag--reassigned, .tag--split, .tag--assigned, .tag--sequenced, .tag--completed { background: var(--t-green); color: var(--t-green-fg); }
    .tag--rescheduled { background: var(--t-pink); color: var(--t-pink-fg); }
    .tag--dry { background: transparent; color: var(--muted); box-shadow: inset 0 0 0 1px var(--n400); }
    .lr.dry p { color: var(--text2); }
    p { font-size: 14px; line-height: 1.4; color: var(--text); }
    .proj, .time { font-size: 14px; color: var(--text2); }
    .undo { font-size: 14px; justify-self: end; }
    .muted { color: var(--muted); font-size: 12px; }
    @media (max-width: 720px) {
      .lr, :host(.no-project) .lr { grid-template-columns: 1fr auto; row-gap: 4px; }
      .tag { justify-self: start; }
      .lr p { grid-column: 1 / -1; }
      .proj { display: none; }
    }
  `],
} )
export class LogRowsComponent {
  readonly store = inject( FlowStore );
  readonly actions = input.required<ToddAction[]>();
  readonly showProject = input( true );

  typeLabel ( a: ToddAction ): string {
    return ( { reassigned: 'Reassigned', split: 'Split', nudged: 'Nudged', rescheduled: 'Rescheduled', assigned: 'Assigned', sequenced: 'Reordered', completed: 'Done', created: 'Created' } as Record<string, string> )[a.type];
  }

  projectName ( id: string ): string {
    return this.store.project( id )?.name || '';
  }

  time ( a: ToddAction ): string {
    return daysBetween( a.createdAt, this.store.state().now ) === 0 ? fmtTime( a.createdAt ) : fmtDay( a.createdAt );
  }
}

