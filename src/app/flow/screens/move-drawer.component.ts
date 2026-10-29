import { Component, computed, HostListener, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { fmtTime, fmtWeekdayDay, fmtWhen, toDate } from '../flow-dates';
import { byRoom, daysStill, downstream, firstName, isOpen, loadOf, moveById, ownerOf, personById, projectById } from '../flow-engine';
import { Lane, MoveEvent } from '../flow.models';
import { FlowStore, LOOSE_PROJECT } from '../flow.store';
import { AvatarComponent, PersonPickerComponent } from '../ui/flow-ui.components';

interface LaneCard { lane: Lane; name: string; text: string; state: 'cant' | 'now' | 'can' | 'suggest'; personId?: string }

/** 05 Move detail - a drawer over the page: next action, who can do it, what happened. */
@Component( {
  selector: 'mv-move-drawer',
  standalone: true,
  imports: [FormsModule, AvatarComponent, PersonPickerComponent],
  template: `
    <div class="scrim" (click)="closed.emit()"></div>
    @if (move(); as m) {
      <aside class="drawer" data-cy="move-drawer" role="dialog" aria-modal="true" [attr.aria-label]="m.title">
        <div class="top">
          <!-- The crumb, title and due tag are editable in place (2026-10-27). -->
          <div class="mv-crumb">
            <select class="crumb-pick" [ngModel]="m.projectId" (ngModelChange)="store.editMove(m.id, { projectId: $event })" aria-label="Project" data-cy="drawer-project">
              @for (p of projectChoices(); track p.id) { <option [value]="p.id">{{ p.name }}</option> }
            </select>{{ m.phase ? ' › ' + m.phase : '' }}
          </div>
          <button type="button" class="close" (click)="closed.emit()" aria-label="Close">&times;</button>
        </div>
        @if (editingTitle()) {
          <input class="mv-input title-input" [(ngModel)]="titleDraft" (keydown.enter)="saveTitle()" (keydown.escape)="editingTitle.set(false)" (blur)="saveTitle()" aria-label="Title" data-cy="drawer-title-input">
        } @else {
          <h2><button type="button" class="title-text" (click)="editTitle()" title="Edit the title" data-cy="drawer-title">{{ m.title }}</button></h2>
        }
        <div class="tags">
          @if (m.done) { <span class="mv-tag mv-tag--green mv-tag--lg">Done</span> }
          @else if (stalled()) { <span class="mv-tag mv-tag--blue mv-tag--lg">Stalled · {{ stalled() }} days</span> }
          @if (editingDue()) {
            <input type="date" class="mv-tag mv-tag--outline due-input" [value]="m.due" (change)="saveDue($any($event.target).value)" (blur)="editingDue.set(false)" aria-label="Due date" data-cy="drawer-due-input">
          } @else {
            <button type="button" class="mv-tag mv-tag--outline due-btn" (click)="editingDue.set(true)" title="Change the due date" data-cy="drawer-due">Due {{ due() }}</button>
          }
          @if (blocks()) { <span class="mv-tag mv-tag--outline">Blocks: {{ blocks() }}</span> }
          @if (m.dateLockedBy) { <span class="mv-tag mv-tag--outline">{{ m.dateLockedBy === 'client' ? 'Client date' : 'Date set by hand' }}</span> }
          @if (project()?.client) { <span class="client">{{ project()!.client!.replace(' Inc.', '') }} · {{ project()!.value }}</span> }
        </div>

        <div class="next" [class.missing]="!m.nextAction.trim()">
          <div class="mv-label">Next action</div>
          @if (editing()) {
            <textarea class="mv-input" rows="2" [(ngModel)]="draft" (keydown.enter)="$event.preventDefault(); saveNext()" (blur)="saveNext()" aria-label="Next action"></textarea>
          } @else {
            <button type="button" class="next-text" (click)="editNext()">{{ m.nextAction.trim() || 'No next action yet. Write one.' }}</button>
          }
        </div>

        <div class="mv-label sec">Who can do this</div>
        <div class="lanes">
          @for (c of lanes(); track c.lane) {
            <div class="lane" [class]="'lane lane--' + c.state">
              <div class="lane-head">
                <mv-avatar [person]="c.lane === 'person' ? person(c.personId) : person(c.lane)" [size]="22" />
                <strong>{{ c.name }}</strong>
              </div>
              <p>{{ c.text }}</p>
              @if (c.state === 'suggest' && c.personId) {
                <button type="button" class="mv-btn mv-btn--primary mv-btn--sm" (click)="store.assign(m.id, c.personId)">Give to {{ first(c.personId) }}</button>
              }
            </div>
          }
        </div>
        @if (isOpenMove()) {
          <div class="owner-row">
            <span class="pick-wrap">
              <button type="button" class="mv-link" (click)="picking.set(!picking())">Give it to someone else</button>
              @if (picking()) { <mv-person-picker [people]="candidates()" (picked)="give($event)" (closed)="picking.set(false)" /> }
            </span>
            <button type="button" class="mv-link" data-cy="drawer-done" (click)="store.markDone(m.id)">Mark done</button>
          </div>
        }

        <div class="mv-label sec">What happened</div>
        <ol class="timeline">
          @for (e of events(); track $index) {
            <li [class.todd]="e.by === 'todd'">
              <span><strong>{{ e.when }}</strong> · {{ e.text }}
                @if (e.actionId && !e.undone) { <button type="button" class="mv-link" data-cy="timeline-undo" (click)="store.undo(e.actionId)">Undo</button> }
                @if (e.undone) { <em>(undone)</em> }
              </span>
            </li>
          } @empty {
            <li><span>Nothing yet.</span></li>
          }
        </ol>

        <form class="ask" (ngSubmit)="send()">
          <input [(ngModel)]="note" name="note" [placeholder]="'General Assistant or leave a note for ' + ownerFirst() + '…'" aria-label="Note">
          <button type="submit" class="mv-btn mv-btn--dark" [disabled]="!note.trim()">Send</button>
        </form>
      </aside>
    }
  `,
  styles: [`
    .scrim { position: fixed; inset: 0; background: var(--scrim); z-index: 900; }
    .drawer {
      position: fixed; top: 16px; right: 16px; bottom: 16px; width: 560px; max-width: calc(100vw - 32px); z-index: 901;
      background: var(--bg); border-radius: 32px; box-shadow: var(--shadow); padding: 28px 30px 24px; display: flex; flex-direction: column; overflow-y: auto;
    }
    .top { display: flex; justify-content: space-between; align-items: center; }
    .close { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--surface2); background: var(--bg); cursor: pointer; font-size: 20px; line-height: 1; color: var(--text); }
    h2 { font-size: 30px; line-height: 1.1; margin-top: 12px !important; }
    .crumb-pick { border: 0; background: none; padding: 0; font: inherit; color: inherit; cursor: pointer; max-width: 100%; }
    .title-text { all: unset; cursor: text; }
    .title-input { margin-top: 12px; font-size: 26px; font-weight: 700; }
    .due-btn { cursor: pointer; font: inherit; }
    .due-input { font: inherit; color: var(--text); }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 14px; }
    .client { font-size: 13px; color: var(--muted); padding: 4px 12px; }
    .next { margin-top: 18px; background: var(--surface); border-radius: 20px; padding: 14px 16px; }
    .next.missing { background: var(--t-pink); }
    .next.missing .next-text { color: var(--t-pink-fg); }
    .next-text { display: block; width: 100%; text-align: left; border: 0; background: none; padding: 4px 0 0; cursor: text; font-size: 17px; font-weight: 700; line-height: 1.35; color: var(--text); }
    .next textarea { margin-top: 6px; font-weight: 700; resize: vertical; }
    .sec { margin-top: 20px; margin-bottom: 10px; }
    .lanes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .lane { border-radius: 16px; padding: 10px 12px; border: 1px solid var(--surface2); font-size: 12px; line-height: 1.35; color: var(--text2); }
    .lane-head { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
    .lane-head strong { font-size: 14px; color: var(--text); }
    .lane--cant { border: 1px dashed var(--n500); }
    .lane--now { border: 2px solid var(--green); background: var(--t-green); color: var(--t-green-fg); }
    .lane--suggest { border: 2px dashed var(--t-pink-fg); }
    .lane .mv-btn { margin-top: 8px; }
    .owner-row { display: flex; gap: 18px; margin-top: 10px; font-size: 13px; }
    .owner-row .mv-link { font-size: 13px; }
    .pick-wrap { position: relative; }
    .timeline { list-style: none; padding: 0; margin: 0; }
    .timeline li { position: relative; padding: 0 0 12px 20px; font-size: 14px; line-height: 1.45; color: var(--text); }
    .timeline li::before { content: ''; position: absolute; left: 0; top: 5px; width: 12px; height: 12px; border-radius: 50%; background: var(--n500); }
    .timeline li::after { content: ''; position: absolute; left: 5px; top: 18px; bottom: -4px; width: 2px; background: var(--surface2); }
    .timeline li:last-child::after { display: none; }
    .timeline li.todd::before { background: var(--green); }
    .timeline em { color: var(--muted); font-size: 13px; }
    .timeline .mv-link { font-size: 14px; }
    .ask { margin-top: auto; padding-top: 18px; display: flex; gap: 8px; background: none; }
    .ask input { flex: 1; min-width: 0; border: 0; background: var(--surface); border-radius: 999px; padding: 12px 18px; font: inherit; font-size: 14px; color: var(--text); }
    @media (max-width: 720px) {
      .drawer { top: 8px; right: 8px; bottom: 8px; left: 8px; width: auto; max-width: none; padding: 22px 18px 18px; border-radius: 28px; }
      .lanes { grid-template-columns: 1fr; }
    }
  `],
} )
export class MoveDrawerComponent {
  readonly store = inject( FlowStore );
  readonly moveId = input.required<string>();
  readonly closed = output<void>();
  readonly editing = signal( false );
  readonly editingTitle = signal( false );
  readonly editingDue = signal( false );
  titleDraft = '';
  readonly picking = signal( false );
  draft = '';
  note = '';

  readonly move = computed( () => moveById( this.store.state(), this.moveId() ) );
  readonly project = computed( () => projectById( this.store.state(), this.move()?.projectId || '' ) );
  /** Real projects, then "Not in a project". */
  readonly projectChoices = computed( () => [
    ...this.store.projects().filter( p => !p.orphan ),
    { id: LOOSE_PROJECT, name: 'Not in a project' },
    ...( this.project()?.orphan && this.project()!.id !== LOOSE_PROJECT ? [{ id: this.project()!.id, name: 'Untitled project' }] : [] ),
  ] );
  readonly isOpenMove = computed( () => !!this.move() && isOpen( this.move()! ) );
  readonly stalled = computed( () => {
    const m = this.move();
    if ( !m || m.done ) return 0;
    const d = daysStill( this.store.state(), m );
    return d >= 4 ? d : 0;
  } );
  readonly due = computed( () => this.move() ? fmtWeekdayDay( this.move()!.due ) : '' );
  readonly blocks = computed( () => {
    const m = this.move();
    if ( !m ) return '';
    const next = downstream( this.store.state(), m.id ).filter( isOpen );
    return next.length ? next[0].title.toLowerCase().replace( /^renewal /, '' ) + ( next.length > 1 ? ` +${next.length - 1}` : '' ) : '';
  } );
  readonly candidates = computed( () => byRoom( this.store.state(), this.move()?.projectId || '', [this.move()?.assigneeId || ''] ) );
  readonly ownerFirst = computed( () => {
    const m = this.move();
    return m ? firstName( ownerOf( this.store.state(), m ) ) : '';
  } );

  readonly lanes = computed<LaneCard[]>( () => {
    const s = this.store.state();
    const m = this.move();
    if ( !m ) return [];
    const notes = m.laneNotes || {};
    const card = ( lane: 'todd' | 'maya' ): LaneCard => {
      const now = m.lane === lane;
      const note = notes[lane];
      const cant = !now && ( !!note?.startsWith( 'Can’t' ) || !note );
      return {
        lane, name: lane === 'todd' ? 'General Assistant' : 'Marketing Assistant', state: now ? 'now' : cant ? 'cant' : 'can',
        text: note || ( now ? 'Has it now.' : lane === 'todd' ? 'Admin only: nudges, dates, follow-ups.' : 'Content only: emails, posts, images.' ),
      };
    };
    const owner = m.lane === 'person' ? personById( s, m.assigneeId ) : undefined;
    const suggest = !owner ? byRoom( s, m.projectId )[0] : undefined;
    const p = owner || suggest;
    const personCard: LaneCard = p
      ? {
        lane: 'person', personId: p.id, state: owner ? 'now' : m.lane === 'person' ? 'suggest' : 'can',
        name: `${firstName( p )}${owner ? ' · now' : ' · most room'}`,
        text: `${owner && notes.person ? notes.person + ' ' : ''}${loadOf( s, p.id ).length} open moves.`,
      }
      : { lane: 'person', state: 'cant', name: 'A person', text: 'Nobody on the project has room.' };
    return [card( 'todd' ), card( 'maya' ), personCard];
  } );

  readonly events = computed( () => {
    const s = this.store.state();
    const m = this.move();
    if ( !m ) return [];
    type Row = MoveEvent & { when: string; undone?: boolean };
    const rows: Row[] = m.history.map( e => ( { ...e, when: e.label || fmtWhen( e.at, s.now ) } ) );
    for ( const a of s.actions ) {
      if ( a.moveId !== m.id && !a.changes.some( c => c.moveId === m.id ) ) continue;
      const who = a.auto ? '16Ahead' : `${firstName( personById( s, s.pmId ) )} via 16Ahead`;
      const text = a.type === 'split' ? a.reason : a.type === 'completed' ? `${a.subject} ${a.text}` : `${who} ${verb( a.type )} ${a.subject} ${a.text}`;
      rows.push( { at: a.createdAt, when: fmtWhen( a.createdAt, s.now ), text, by: 'todd', actionId: a.id, undone: !!a.undoneAt } );
    }
    return rows.sort( ( a, b ) => toDate( a.at ).getTime() - toDate( b.at ).getTime() )
      .map( ( r, i, list ) => i > 0 && fmtWhen( list[i - 1].at, s.now ).startsWith( 'Today' ) && r.when.startsWith( 'Today' ) ? { ...r, when: fmtTime( r.at ) } : r );
  } );

  person ( id: string | undefined ) {
    return personById( this.store.state(), id );
  }

  first ( id: string ): string {
    return firstName( this.person( id ) );
  }

  editNext (): void {
    this.draft = this.move()?.nextAction || '';
    this.editing.set( true );
  }

  saveNext (): void {
    if ( !this.editing() ) return;
    this.editing.set( false );
    const m = this.move();
    if ( m && this.draft.trim() !== m.nextAction ) this.store.updateNextAction( m.id, this.draft.trim() );
  }

  editTitle (): void {
    this.titleDraft = this.move()?.title || '';
    this.editingTitle.set( true );
  }

  saveTitle (): void {
    if ( !this.editingTitle() ) return;
    this.editingTitle.set( false );
    const m = this.move();
    if ( m && this.titleDraft.trim() ) this.store.editMove( m.id, { title: this.titleDraft } );
  }

  saveDue ( day: string ): void {
    this.editingDue.set( false );
    const m = this.move();
    if ( m && /^\d{4}-\d{2}-\d{2}$/.test( day ) ) this.store.editMove( m.id, { due: day } );
  }

  give ( personId: string ): void {
    this.picking.set( false );
    this.store.assign( this.moveId(), personId );
  }

  send (): void {
    const text = this.note.trim();
    if ( !text ) return;
    this.note = '';
    void this.store.addNote( this.moveId(), text );
  }

  @HostListener( 'document:keydown.escape' )
  onEsc (): void {
    if ( !this.picking() && !this.editing() ) this.closed.emit();
  }
}

function verb ( type: string ): string {
  return ( { reassigned: 'moved', assigned: 'gave', nudged: 'nudged', rescheduled: 'moved', sequenced: 'reordered', created: 'created', split: 'split' } as Record<string, string> )[type] || type;
}

