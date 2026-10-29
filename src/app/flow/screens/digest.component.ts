import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { addDays, daysBetween, fmtWeekday } from '../flow-dates';
import { byRoom, choiceLabel, liveActions, marginNote, moveById, projectHealth, projectMoves, trackFor } from '../flow-engine';
import { Issue, IssueChoice } from '../flow.models';
import { FlowStore } from '../flow.store';
import { FlowTrackComponent } from '../ui/flow-track.component';
import { PersonPickerComponent, BrandMarkComponent } from '../ui/flow-ui.components';

/** 10 Mobile, PM digest - the morning email as a screen: what broke, one tap to fix, what TODD fixed. */
@Component( {
  selector: 'mv-digest',
  standalone: true,
  imports: [BrandMarkComponent, RouterLink, FlowTrackComponent, PersonPickerComponent],
  template: `
    <div class="col">
      <div class="kicker"><mv-mark name="16ahead" class="dial" /> Morning digest · {{ weekday }}</div>
      <h1>{{ headline() }}</h1>
      <p class="sub">I fixed {{ fixed().length }} smaller thing{{ fixed().length === 1 ? '' : 's' }}. <a routerLink="/app/todd">See the log</a></p>

      @for (c of cards(); track c.issue.id) {
        <article class="dc">
          <header>
            <h2>{{ c.name }}</h2>
            @if (c.issue.kind === 'order') { <span class="kind">Order</span> }
            @else { <span class="mv-tag" [class.mv-tag--pink]="c.tone === 'pink'">{{ c.tag }}</span> }
          </header>
          @if (c.issue.kind !== 'order') {
            <mv-flow-track [model]="c.track" size="mini" [showToday]="false" (nodeClick)="open($event)" />
          }
          <p>{{ c.text }}</p>
          <div class="btns">
            @if (c.issue.choices[0]; as first) {
              <button type="button" class="mv-btn mv-btn--primary big" (click)="run(first, c.issue)">{{ c.issue.kind === 'order' ? 'Apply' : label(first) }}</button>
            }
            @if (canPick(c.issue)) {
              <span class="pick-wrap">
                <button type="button" class="mv-btn big ghost" (click)="picking.set(picking() === c.issue.id ? '' : c.issue.id)">Pick</button>
                @if (picking() === c.issue.id) { <mv-person-picker [people]="people(c.issue)" (picked)="pick(c.issue, $event)" (closed)="picking.set('')" /> }
              </span>
            } @else if (c.issue.kind === 'order') {
              <button type="button" class="mv-btn big ghost" (click)="run(c.issue.choices[1], c.issue)">Keep</button>
            } @else if (c.issue.choices[1]) {
              <button type="button" class="mv-btn big ghost" (click)="run(c.issue.choices[1], c.issue)">{{ label(c.issue.choices[1]) }}</button>
            }
          </div>
        </article>
      } @empty {
        <p class="calm">Nothing broke. Every line is moving.</p>
      }

      @if (did(); as a) {
        <div class="did">{{ a.note || a.subject + ' ' + a.text }} <button type="button" class="mv-link" (click)="store.undo(a.id)">Undo</button></div>
      }
    </div>
  `,
  styles: [`
    .col { max-width: 440px; margin: 0 auto; padding: 32px 20px 40px; }
    .kicker { display: flex; align-items: center; gap: 12px; font-size: 14px; color: var(--muted); }
    .kicker .dial { width: 30px; height: 30px; }
    h1 { font-size: 34px; line-height: 1.05; margin-top: 16px !important; }
    .sub { font-size: 15px; color: var(--text); margin-top: 10px !important; }
    .dc { background: var(--surface); border-radius: 32px; padding: 18px 18px 16px; margin-top: 18px; }
    .dc header { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .dc h2 { font-size: 17px; letter-spacing: -0.01em; }
    .kind { font-size: 12px; font-weight: 700; color: var(--text2); }
    .dc p { font-size: 15px; line-height: 1.45; margin-top: 8px !important; }
    mv-flow-track { margin-top: 6px; }
    .btns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
    .big { padding: 13px; font-size: 16px; width: 100%; }
    .ghost { background: transparent; }
    .pick-wrap { position: relative; }
    .did { margin-top: 18px; border: 1.5px dashed var(--n500); border-radius: 999px; padding: 14px 20px; font-size: 14px; color: var(--text2); }
    .did .mv-link { font-size: 14px; }
    .calm { font-size: 15px; color: var(--text2); margin-top: 20px; }
  `],
} )
export class DigestComponent {
  readonly store = inject( FlowStore );
  private readonly router = inject( Router );
  readonly weekday = fmtWeekday( new Date() );
  readonly picking = signal( '' );

  readonly fixed = computed( () => {
    const s = this.store.state();
    return liveActions( s ).filter( a => a.auto && daysBetween( a.createdAt, s.now ) === 0 );
  } );

  readonly cards = computed( () => {
    const s = this.store.state();
    const issues = this.store.issues();
    const range = { start: addDays( s.now, -8 ), end: addDays( s.now, 13 ) };
    return this.store.projects().map( p => ( { p, note: marginNote( s, p.id, issues ) } ) )
      .filter( x => x.note.kind === 'needs' )
      .map( ( { p, note } ) => {
        const issue = ( note as { issue: Issue } ).issue;
        const health = projectHealth( s, p, issues );
        const track = trackFor( s, projectMoves( s, p.id ), issues, range );
        return {
          issue, name: p.name, tag: health.label.split( ' · ' )[0], tone: health.tone,
          track: { ...track, nodes: track.nodes.map( n => ( { ...n, label: undefined } ) ), today: null },
          text: this.textFor( issue ),
        };
      } );
  } );
  readonly headline = computed( () => {
    const n = this.cards().length;
    return n ? `${n} line${n === 1 ? '' : 's'} broke overnight` : 'Every line is moving';
  } );
  readonly did = computed( () => {
    const s = this.store.state();
    return this.fixed().filter( a => a.type === 'reassigned' && a.changes.length ).sort( ( a, b ) => b.createdAt.localeCompare( a.createdAt ) )[0]
      || liveActions( s ).filter( a => daysBetween( a.createdAt, s.now ) === 0 && a.changes.length ).sort( ( a, b ) => b.createdAt.localeCompare( a.createdAt ) )[0];
  } );

  private textFor ( i: Issue ): string {
    const s = this.store.state();
    const m = moveById( s, i.moveIds[0] );
    if ( i.kind === 'gap' && m && i.id.startsWith( 'gap:owner' ) ) {
      const ship = this.store.project( i.projectId )?.shipsOn;
      return `${m.title} needs an owner by ${fmtWeekday( m.due )}${ship ? ' or launch slips a week' : ''}.`;
    }
    if ( i.kind === 'order' ) {
      const dep = moveById( s, i.moveIds[1] );
      const last = projectMoves( s, i.projectId ).filter( x => x.dateLockedBy ).pop();
      return `Swap the ${dep?.title.toLowerCase()} and ${m?.title.toLowerCase()}.${last ? ` The ${last.title.toLowerCase()} date holds.` : ''}`;
    }
    return i.explanation;
  }

  canPick ( i: Issue ): boolean {
    return i.kind === 'gap' && i.choices[0]?.run.kind === 'assign';
  }

  label ( c: IssueChoice ): string {
    return choiceLabel( c );
  }

  people ( i: Issue ) {
    return byRoom( this.store.state(), i.projectId );
  }

  run ( c: IssueChoice, i: Issue ): void {
    if ( c.run.kind === 'open' ) this.open( c.run.moveId );
    else this.store.run( c, i );
  }

  pick ( i: Issue, personId: string ): void {
    this.picking.set( '' );
    this.store.assign( i.moveIds[0], personId );
  }

  open ( id: string ): void {
    void this.router.navigate( [], { queryParams: { move: id }, queryParamsHandling: 'merge' } );
  }
}
