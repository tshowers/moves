import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { addDays, daysBetween, fmtDay } from '../flow-dates';
import {
  byRoom, firstName, isOpen, liveActions, loadOf, MAYA_ID, moveById, needsYou, ownerOf, TODD_ID, trackFor,
} from '../flow-engine';
import { FlowMove, Issue, Person, TrackModel } from '../flow.models';
import { FlowStore } from '../flow.store';
import { FlowTrackComponent } from '../ui/flow-track.component';
import { AvatarComponent } from '../ui/flow-ui.components';

interface Row {
  person?: Person;
  load: number;
  loadText: string;
  fill: number;
  over: boolean;
  track: TrackModel;
  note: { text: string; tone?: 'green' | 'card'; issue?: Issue; link?: string; action?: { label: string; moveId: string; personId: string } };
}

const WINDOW = 14;

/** 06 Team - each person's moves across every project for the next two weeks, assistants first. */
@Component( {
  selector: 'mv-team',
  standalone: true,
  imports: [FlowTrackComponent, AvatarComponent],
  template: `
    <div class="mv-page">
      <header class="head">
        <div>
          <h1 class="mv-title">Team</h1>
          <p class="mv-sub">Each person’s moves for the next 2 weeks, all projects</p>
        </div>
        <div class="mv-seg" role="group" aria-label="Filter">
          <button type="button" [class.on]="filter() === 'all'" (click)="filter.set('all')">Everyone</button>
          <button type="button" [class.on]="filter() === 'over'" (click)="filter.set('over')">Over capacity</button>
          @if (focusProject(); as fp) {
            <button type="button" [class.on]="filter() === 'project'" (click)="filter.set('project')">{{ fp.name.split(' ')[0] }} only</button>
          }
        </div>
      </header>

      <div class="grid">
        <div class="mv-label">Owner</div>
        <div class="mv-label">Load</div>
        <div class="axis"><span>Today</span><span [style.left.%]="50">{{ mid }}</span><span class="end">{{ end }}</span></div>
        <div></div>

        @for (r of rows(); track r.person?.id ?? 'none') {
          <div class="owner">
            <mv-avatar [person]="r.person" [size]="32" />
            <div>
              <strong [class.pink]="!r.person">{{ r.person?.name ?? 'No owner' }}</strong>
              <span>{{ r.person?.role ?? 'across projects' }}</span>
            </div>
          </div>
          <div class="load">
            @if (r.person) { <div class="bar"><i [style.width.%]="r.fill * 100" [class.over]="r.over"></i></div> }
            <span [class.pink]="r.over || !r.person">{{ r.loadText }}</span>
          </div>
          <mv-flow-track [model]="r.track" size="row" [showToday]="false" (nodeClick)="open($event)" />
          <div class="note">
            @if (r.note.action; as a) {
              <button type="button" class="mv-btn mv-btn--primary mv-btn--sm" (click)="store.assign(a.moveId, a.personId)">{{ a.label }}</button>
            } @else if (r.note.tone === 'card') {
              <div class="nc">{{ r.note.text }} @if (r.note.link) { <a (click)="go(r.note.link)">See</a> }</div>
            } @else {
              <span [class.green]="r.note.tone === 'green'">{{ r.note.text }}</span>
            }
          </div>
        }
      </div>

      @if (hidden() > 0) {
        <p class="foot">Showing {{ shownPeople() }} of {{ totalPeople() }} people · <button type="button" class="mv-link" (click)="showAll.set(true)">Show everyone</button></p>
      }
    </div>
  `,
  styles: [`
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; }
    .grid { display: grid; grid-template-columns: 190px 110px minmax(0, 1fr) 230px; column-gap: 20px; margin-top: 24px; align-items: center; }
    .grid > * { border-bottom: 1px solid var(--surface2); min-height: 56px; display: flex; align-items: center; }
    .grid > .mv-label, .grid > .axis, .grid > div:nth-child(4) { min-height: 0; padding-bottom: 8px; }
    .axis { position: relative; font-size: 12px; color: var(--muted); height: 24px; }
    .axis span { position: absolute; bottom: 8px; white-space: nowrap; }
    .axis span:nth-child(2) { transform: translateX(-50%); }
    .axis .end { right: 0; }
    .owner { gap: 10px; }
    .owner div { display: flex; flex-direction: column; line-height: 1.2; }
    .owner strong { font-size: 15px; }
    .owner span { font-size: 12px; color: var(--muted); }
    .pink { color: var(--t-pink-fg); font-weight: 700; }
    .load { flex-direction: column; align-items: flex-start !important; justify-content: center; gap: 5px; }
    .bar { width: 110px; height: 8px; border-radius: 4px; background: var(--surface2); overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--green); border-radius: 4px; }
    .bar i.over { background: var(--pink); }
    .load span { font-size: 12px; color: var(--text2); }
    .grid > mv-flow-track { display: block; width: 100%; }
    .note { font-size: 13px; color: var(--text2); }
    .note .green { color: var(--t-green-fg); }
    .nc { background: var(--bg); box-shadow: var(--shadow-md); border-radius: 18px; padding: 10px 14px; color: var(--text); line-height: 1.4; }
    .foot { margin-top: 28px; font-size: 13px; color: var(--muted); }
    .foot .mv-link { font-size: 13px; }
    @media (max-width: 1100px) { .grid { grid-template-columns: 170px 100px minmax(0, 1fr) 180px; } }
    @media (max-width: 900px) {
      .grid { grid-template-columns: minmax(0, 1fr) 110px; }
      .grid > .axis, .grid > div:nth-child(4) { display: none; }
      mv-flow-track { grid-column: 1 / -1; border-bottom: 0 !important; }
      .note { grid-column: 1 / -1; padding: 0 0 14px; }
    }
  `],
} )
export class TeamComponent {
  readonly store = inject( FlowStore );
  private readonly router = inject( Router );
  readonly filter = signal<'all' | 'over' | 'project'>( 'all' );
  readonly showAll = signal( false );

  readonly mid = fmtDay( addDays( new Date(), WINDOW / 2 ) );
  readonly end = fmtDay( addDays( new Date(), WINDOW ) );

  readonly focusProject = computed( () => {
    const i = this.store.needsYou().find( x => this.store.project( x.projectId ) );
    return i ? this.store.project( i.projectId ) : this.store.projects()[0];
  } );

  private readonly allRows = computed( () => {
    const s = this.store.state();
    const issues = this.store.issues();
    const range = { start: s.now, end: addDays( s.now, WINDOW ) };
    const assistants = [MAYA_ID, TODD_ID].map( id => s.people.find( p => p.id === id ) ).filter( ( p ): p is Person => !!p );
    const people = s.people.filter( p => p.kind === 'person' && loadOf( s, p.id, WINDOW ).length > 0 )
      .sort( ( a, b ) => loadOf( s, b.id, WINDOW ).length - loadOf( s, a.id, WINDOW ).length );

    const rowFor = ( person: Person ): Row => {
      const moves = loadOf( s, person.id, WINDOW );
      const load = moves.length;
      const full = load >= person.capacity;
      const newToday = liveActions( s ).filter( a => daysBetween( a.createdAt, s.now ) === 0 && a.changes.some( c => c.after?.assigneeId === person.id ) ).length;
      const loadText = `${load} move${load === 1 ? '' : 's'}${load > person.capacity ? ' · over' : full ? ' · full' : newToday ? ` · +${newToday} today` : person.capacity - load >= 4 ? ' · has room' : ''}`;
      return { person, load, loadText, fill: Math.min( 1, load / person.capacity ), over: full, track: this.trackOf( moves, range ), note: this.noteFor( person, moves, issues ) };
    };

    const gaps = s.moves.filter( m => isOpen( m ) && m.lane === 'person' && !m.assigneeId && daysBetween( s.now, m.due ) <= WINDOW );
    const gapIssue = needsYou( issues ).find( i => i.kind === 'gap' && gaps.some( g => g.id === i.moveIds[0] ) );
    const best = gapIssue?.choices[0]?.run;
    const noOwner: Row | null = gaps.length ? {
      load: gaps.length, loadText: `${gaps.length} move${gaps.length === 1 ? '' : 's'}`, fill: 0, over: true, track: this.trackOf( gaps, range ),
      note: best?.kind === 'assign'
        ? { text: '', action: { label: `Give ${( moveById( s, best.moveId )?.short || moveById( s, best.moveId )?.title || '' ).split( ' ' )[0]} to ${firstName( s.people.find( p => p.id === best.personId ) )}`, moveId: best.moveId, personId: best.personId } }
        : { text: '' },
    } : null;

    return { assistants: assistants.map( rowFor ), people: people.map( rowFor ), noOwner, total: s.people.filter( p => p.kind === 'person' ).length };
  } );

  readonly rows = computed( () => {
    const all = this.allRows();
    let people = all.people;
    if ( this.filter() === 'over' ) people = people.filter( r => r.over );
    if ( this.filter() === 'project' ) {
      const fp = this.focusProject();
      people = people.filter( r => fp?.memberIds.includes( r.person!.id ) );
    }
    const limit = this.showAll() || this.filter() !== 'all' ? people.length : 4;
    return [...( this.filter() === 'all' ? all.assistants : [] ), ...people.slice( 0, limit ), ...( all.noOwner && this.filter() === 'all' ? [all.noOwner] : [] )];
  } );
  readonly totalPeople = computed( () => this.allRows().total );
  readonly shownPeople = computed( () => this.rows().filter( r => r.person ).length );
  readonly hidden = computed( () => this.filter() === 'all' && !this.showAll() ? this.allRows().people.length - Math.min( 4, this.allRows().people.length ) : 0 );

  private trackOf ( moves: FlowMove[], range: { start: Date; end: Date } ): TrackModel {
    const s = this.store.state();
    const issues = this.store.issues();
    const piled = moves.filter( m => daysBetween( m.due, s.now ) >= 0 );
    const pile = piled.length >= 3;
    const shown = ( pile ? moves.filter( m => !piled.includes( m ) ) : moves ).map( m => daysBetween( m.due, s.now ) > 0 ? { ...m, due: s.now.toISOString() } : m );
    const model = trackFor( s, shown, issues, range );
    const nodes = pile ? [{ id: 'pile', x: 0.04, kind: 'pileup' as const, text: String( piled.length ) }, ...model.nodes] : model.nodes.map( n => ( { ...n, label: undefined } ) );
    return { nodes, today: null, progress: 0 };
  }

  private noteFor ( person: Person, moves: FlowMove[], issues: Issue[] ): Row['note'] {
    const s = this.store.state();
    if ( person.id === MAYA_ID ) {
      const pile = issues.find( i => i.kind === 'pileup' && i.status === 'needs_you' );
      const moved = liveActions( s ).filter( a => daysBetween( a.createdAt, s.now ) <= 1 && a.changes.some( c => c.before?.lane === 'maya' ) ).length;
      if ( pile ) return { tone: 'card', text: `Pile-up from its daily plans. ${moved} moved to people, ${pile.moveIds.length} need you.`, link: `/app/review?item=${encodeURIComponent( pile.id )}` };
      return { text: moves.length ? `${moves.length} moves from its daily plans.` : '' };
    }
    if ( person.id === TODD_ID ) return { text: moves.slice( 0, 2 ).map( m => m.title ).join( ', ' ) };
    const ids = moves.map( m => m.id );
    const fresh = liveActions( s ).find( a => daysBetween( a.createdAt, s.now ) === 0 && a.changes.some( c => c.after?.assigneeId === person.id ) );
    if ( fresh ) {
      const m = moveById( s, fresh.moveId );
      const from = fresh.changes.find( c => c.after?.assigneeId === person.id )?.before?.lane === 'maya' ? ', from the Marketing Assistant' : '';
      return { tone: 'green', text: `New: ${m?.short ? ( this.store.project( m.projectId )?.name.split( ' ' )[0] + ' ' + m.short.toLowerCase() ) : m?.title}${from}` };
    }
    const stall = issues.find( i => i.kind === 'stall' && ids.includes( i.moveIds[0] ) );
    if ( stall ) {
      const m = moveById( s, stall.moveIds[0] )!;
      return { text: `${m.title} stalled.${liveActions( s ).some( a => a.type === 'nudged' && a.moveId === m.id ) ? ' Nudged.' : ''}` };
    }
    const gap = needsYou( issues ).find( i => i.kind === 'gap' && i.choices[0]?.run.kind === 'assign' && ( i.choices[0].run as { personId: string } ).personId === person.id );
    if ( gap ) return { text: `Suggested for ${moveById( s, gap.moveIds[0] )?.title}` };
    const order = issues.find( i => i.kind === 'order' && i.moveIds[1] && ownerOf( s, moveById( s, i.moveIds[1] )! )?.id === person.id );
    if ( order ) return { text: `${moveById( s, order.moveIds[1] )?.title} may move up` };
    const cap = issues.find( i => i.id === `capacity:${person.id}` );
    if ( cap ) return { text: cap.title };
    const room = byRoom( s, '' )[0];
    return { text: room?.id === person.id ? 'Most room this week' : '' };
  }

  open ( id: string ): void {
    if ( id === 'pile' ) return;
    void this.router.navigate( [], { queryParams: { move: id }, queryParamsHandling: 'merge' } );
  }

  go ( url: string ): void {
    void this.router.navigateByUrl( url );
  }
}
