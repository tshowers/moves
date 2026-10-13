import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { fmtLong } from '../flow-dates';
import {
  byRoom, choiceLabel, issueBrief, liveActions, marginNote, projectHealth, projectMoves, rangeFor, tickLabels, trackFor, xOf,
} from '../flow-engine';
import { Issue, IssueChoice, RangeKey } from '../flow.models';
import { FlowStore } from '../flow.store';
import { FlowTrackComponent } from '../ui/flow-track.component';
import { PersonPickerComponent, TODD_ICON } from '../ui/flow-ui.components';
import { daysBetween } from '../flow-dates';

/** 01 Momentum - the PM's home: every project as a line against today, TODD's notes in the margin. */
@Component( {
  selector: 'mv-momentum',
  standalone: true,
  imports: [RouterLink, FlowTrackComponent, PersonPickerComponent],
  template: `
    <div class="mv-page" data-cy="momentum">
      <header class="head">
        <div>
          <h1 class="mv-title">Momentum</h1>
          <p class="mv-sub">{{ subtitle() }}</p>
        </div>
        <div class="controls">
          <div class="mv-seg" role="group" aria-label="Range">
            @for (r of ranges; track r.key) {
              <button type="button" [class.on]="store.range() === r.key" (click)="store.range.set(r.key)">{{ r.label }}</button>
            }
          </div>
          <a class="mv-btn mv-btn--dark mv-btn--lg start" routerLink="/app/review">Start review</a>
        </div>
      </header>

      <section class="banner">
        <img [src]="todd" alt="TODD" class="mv-icon mv-plate">
        <p><strong>{{ banner().lead }}</strong> {{ banner().rest }}</p>
        <a class="mv-btn" routerLink="/app/todd">See the log</a>
      </section>

      @if (!rows().length) {
        <div class="mv-empty">No projects yet. <a routerLink="/app/new">Start one from a plan you already have</a>.</div>
      } @else {
        <div class="grid">
          <div class="axis-spacer"></div>
          <div class="axis">
            @for (t of ticks(); track t.label) { <span [style.left.%]="t.x * 100">{{ t.label }}</span> }
            @if (todayX() !== null) { <span class="today" [style.left.%]="todayX()! * 100">Today</span> }
          </div>
          <div class="mv-label axis-note">TODD</div>

          @for (row of rows(); track row.project.id) {
            <div class="name" data-cy="momentum-name">
              <a [routerLink]="['/app/projects', row.project.id]">{{ row.project.name }}</a>
              <span class="mv-tag" [class.mv-tag--pink]="row.health.tone === 'pink'" [class.mv-tag--green]="row.health.tone === 'green'">{{ row.health.label }}</span>
            </div>
            <mv-flow-track [model]="row.track" (nodeClick)="openMove($event)" [attr.data-cy]="'track-' + row.project.id" />
            <div class="note">
              @switch (row.note.kind) {
                @case ('needs') {
                  @if (asIssue(row.note); as i) {
                    <div class="mv-card mv-card--note nc">
                      <p><strong>{{ i.title }}.</strong> {{ brief(i) }}</p>
                      <div class="actions">
                        @if (i.kind === 'order') {
                          <a class="mv-btn mv-btn--primary mv-btn--sm" [routerLink]="['/app/projects', i.projectId, 'sequence']">See fix</a>
                        } @else if (i.choices[0]) {
                          <button type="button" class="mv-btn mv-btn--primary mv-btn--sm" data-cy="note-primary" (click)="run(i.choices[0], i)">{{ label(i.choices[0]) }}</button>
                        }
                        @if (canPick(i)) {
                          <span class="pick-wrap">
                            <button type="button" class="mv-btn mv-btn--sm" (click)="picking.set(picking() === i.id ? '' : i.id)">Other</button>
                            @if (picking() === i.id) {
                              <mv-person-picker [people]="people(i)" (picked)="assign(i, $event)" (closed)="picking.set('')" />
                            }
                          </span>
                        }
                      </div>
                    </div>
                  }
                }
                @case ('did') {
                  @if (asAction(row.note); as a) {
                    <div class="mv-card mv-card--dashed nc did">{{ a.note || a.subject + ' ' + a.text }} <button type="button" class="mv-link" (click)="store.undo(a.id)">Undo</button></div>
                  }
                }
                @case ('watch') { <p class="quiet">{{ asText(row.note) }}</p> }
                @default { <p class="quiet">Nothing to flag</p> }
              }
            </div>
          }
        </div>
      }

      <footer class="legend">
        <span><i class="lg done"></i>Done</span>
        <span><i class="lg up"></i>Upcoming</span>
        <span><i class="lg stall"></i>Stalled (days still)</span>
        <span><i class="lg gap"></i>No owner</span>
        <span><i class="g violet">&#8644;</i>Out of order</span>
        <span><i class="g green">&#10003;</i>Fixed by TODD</span>
      </footer>
    </div>
  `,
  styles: [`
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; }
    .controls { display: flex; align-items: center; gap: 16px; padding-top: 8px; }
    .start { padding: 11px 20px; text-decoration: none !important; color: var(--bg) !important; }
    .banner { margin-top: 24px; display: flex; align-items: center; gap: 18px; background: var(--surface); border-radius: 28px; padding: 14px 18px 14px 18px; }
    .banner p { flex: 1; font-size: 16px; line-height: 1.4; color: var(--text); }
    .banner .mv-btn { text-decoration: none; color: var(--text); padding: 9px 16px; }
    .grid { display: grid; grid-template-columns: 200px minmax(0, 1fr) 250px; column-gap: 24px; margin-top: 26px; align-items: center; }
    .axis { position: relative; height: 22px; font-size: 12px; color: var(--muted); }
    .axis span { position: absolute; transform: translateX(-50%); white-space: nowrap; }
    .axis span:first-child { transform: none; }
    .axis .today { color: var(--blue-ink); font-weight: 700; }
    .axis-note { align-self: end; padding-bottom: 2px; }
    .name { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 14px 0; }
    .name a { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: var(--text); text-decoration: none; }
    .name a:hover { text-decoration: underline; }
    mv-flow-track { padding-top: 22px; }
    .note { padding: 8px 0; position: relative; }
    .nc { padding: 12px 14px; border-radius: 18px; font-size: 13px; line-height: 1.4; }
    .nc strong { font-weight: 700; }
    .actions { display: flex; gap: 6px; margin-top: 8px; }
    .pick-wrap { position: relative; }
    .did { color: var(--text2); }
    .did .mv-link { font-size: 13px; }
    .quiet { font-size: 13px; color: var(--text2); }
    .legend { display: flex; flex-wrap: wrap; gap: 22px; margin-top: 40px; font-size: 12px; color: var(--text2); }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .lg { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
    .lg.done { background: var(--green); }
    .lg.up { border: 2px solid var(--n500); }
    .lg.stall { background: var(--yellow); }
    .lg.gap { border: 2px dashed var(--t-pink-fg); background: var(--t-pink); }
    .g { font-style: normal; font-weight: 700; }
    .g.violet { color: var(--violet); }
    .g.green { color: var(--green); }
    @media (max-width: 1100px) {
      .grid { grid-template-columns: 170px minmax(0, 1fr) 210px; column-gap: 16px; }
    }
    @media (max-width: 900px) {
      .grid { grid-template-columns: minmax(0, 1fr); }
      .axis-spacer, .axis-note { display: none; }
      .name { padding-bottom: 0; border-top: 1px solid var(--surface2); padding-top: 18px; }
      .grid > .axis { margin-top: 8px; }
      mv-flow-track { padding-top: 6px; }
      .controls { width: 100%; justify-content: space-between; }
      .legend { gap: 12px 18px; }
    }
  `],
} )
export class MomentumComponent {
  readonly store = inject( FlowStore );
  private readonly router = inject( Router );
  readonly todd = TODD_ICON;
  readonly picking = signal( '' );
  readonly ranges: { key: RangeKey; label: string }[] = [{ key: '1w', label: '1 week' }, { key: '3w', label: '3 weeks' }, { key: 'q', label: 'Quarter' }];

  private readonly range = computed( () => rangeFor( this.store.range(), this.store.state().now ) );
  readonly ticks = computed( () => {
    const today = xOf( this.store.state().now, this.range() );
    return tickLabels( this.range() ).filter( t => Math.abs( t.x - today ) > 0.08 );
  } );
  readonly todayX = computed( () => {
    const x = xOf( this.store.state().now, this.range() );
    return x >= 0 && x <= 1 ? x : null;
  } );

  readonly subtitle = computed( () => {
    const s = this.store.state();
    const people = s.people.filter( p => p.kind === 'person' ).length;
    return `${fmtLong( s.now )} · ${s.projects.length} project${s.projects.length === 1 ? '' : 's'} · ${people} ${people === 1 ? 'person' : 'people'}`;
  } );

  readonly rows = computed( () => {
    const s = this.store.state();
    const issues = this.store.issues();
    return this.store.projects().map( project => ( {
      project,
      health: projectHealth( s, project, issues ),
      track: trackFor( s, projectMoves( s, project.id ), issues, this.range() ),
      note: marginNote( s, project.id, issues ),
    } ) );
  } );

  readonly banner = computed( () => {
    const s = this.store.state();
    const broke = this.rows().filter( r => r.note.kind === 'needs' ).length;
    const fixed = liveActions( s ).filter( a => a.auto && daysBetween( a.createdAt, s.now ) === 0 );
    const words = ['zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
    const lead = broke ? `${words[broke] || broke} line${broke === 1 ? '' : 's'} broke overnight.` : 'Every line is moving.';
    if ( !fixed.length ) return { lead, rest: broke ? 'They need you. Everything else is on track.' : 'Nothing needs you today.' };
    const n = ( t: string ) => fixed.filter( a => a.type === t ).length;
    const parts = [
      n( 'nudged' ) ? 'nudges' : '',
      n( 'rescheduled' ) ? `${n( 'rescheduled' ) === 1 ? 'one reschedule' : `${words[n( 'rescheduled' )]?.toLowerCase() || n( 'rescheduled' )} reschedules`}` : '',
      n( 'reassigned' ) ? `${n( 'reassigned' ) === 1 ? 'one hand-off' : n( 'reassigned' ) + ' hand-offs'} from Maya` : '',
    ].filter( Boolean );
    return { lead, rest: `I fixed ${fixed.length} smaller thing${fixed.length === 1 ? '' : 's'}${broke ? ' on the others' : ''}${parts.length ? ': ' + parts.join( ', ' ) : ''}.` };
  } );

  asIssue ( n: ReturnType<typeof marginNote> ) { return n.kind === 'needs' ? n.issue : null; }
  asAction ( n: ReturnType<typeof marginNote> ) { return n.kind === 'did' ? n.action : null; }
  asText ( n: ReturnType<typeof marginNote> ) { return n.kind === 'watch' ? n.text : ''; }
  brief ( i: Issue ): string { return issueBrief( this.store.state(), i ); }
  label ( c: IssueChoice ): string { return choiceLabel( c ); }
  people ( i: Issue ) { return byRoom( this.store.state(), i.projectId ); }
  canPick ( i: Issue ): boolean { return i.kind === 'gap' && i.choices[0]?.run.kind === 'assign'; }

  run ( c: IssueChoice, i: Issue ): void {
    if ( c.run.kind === 'open' ) this.openMove( c.run.moveId );
    else this.store.run( c, i );
  }

  assign ( i: Issue, personId: string ): void {
    this.picking.set( '' );
    this.store.assign( i.moveIds[0], personId );
  }

  openMove ( id: string ): void {
    void this.router.navigate( [], { queryParams: { move: id }, queryParamsHandling: 'merge' } );
  }
}
