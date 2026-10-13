import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';

import { Task } from '../models/task.model';
import { MovesAdminService } from '../services/moves-admin.service';
import { MovesAuthService } from '../services/moves-auth.service';
import { MovesDataService } from '../services/moves-data.service';
import { TaskApiService } from '../services/task-api.service';
import { WriteAccessService, WriteAccessState } from '../services/write-access.service';
import { WriteAccessPromptService } from '../shared/write-access/write-access-prompt.service';
import { WRITE_ACCESS_APP } from '../shared/write-access/write-access.config';
import { FlowApiService, ServerFlowState } from './flow-api.service';
import { addDays, fmtDay, fmtWeekday, isoDay } from './flow-dates';
import { demoState } from './flow-demo.data';
import {
  byRoom, computeIssues, defaultRules, Dismissal, firstName, FlowState, MAYA_ID, moveById, needsYou, ownerOf, personById,
  projectById, sequenceProposal, TODD_ID,
} from './flow-engine';
import { Autonomy, FlowMove, FlowProject, Issue, IssueChoice, Lane, MoveChange, Person, RangeKey, ToddAction, ToddActionType } from './flow.models';

export interface FlowToast { id: number; msg: string; undo?: () => void }

/** A plan pasted on the New project screen, parsed into moves. */
export interface PlanDraft {
  name: string;
  launch: string;
  moves: { title: string; ownerId: string | null; lane: Lane; due: string; nextAction: string; dependsOn: number[] }[];
}

/** What the web app kept in the browser before /moves/flow existed - uploaded once, then removed. */
interface LegacyLocal { actions?: ToddAction[]; rules?: FlowState['rules']; dismissed?: Record<string, Dismissal>; overlay?: Record<string, Partial<FlowMove>> }

/** The flow fields an action may change on the server (moves/flow.service FLOW_FIELDS). */
const FLOW_FIELDS = ['assigneeId', 'lane', 'due', 'done', 'nextAction', 'dependsOn', 'dateLockedBy', 'title', 'laneNotes'] as const;

/** yyyy-mm-dd for an API date. Date-only values come back as UTC midnight, which would read as the day before west of UTC. */
function apiDay ( value: string | undefined ): string {
  if ( !value ) return '';
  return /T00:00:00(\.000)?Z$/.test( value ) ? value.slice( 0, 10 ) : isoDay( value );
}

/**
 * The part of a local change the server applies. Bookkeeping like
 * lastActivityAt is the server's to set; an unset date lock means "unlock".
 */
function flowPatch ( after: Partial<FlowMove> ): Partial<FlowMove> {
  const out: Record<string, unknown> = {};
  for ( const key of FLOW_FIELDS ) {
    if ( !( key in after ) ) continue;
    const value = after[key];
    out[key] = value === undefined ? ( key === 'dateLockedBy' ? '' : null ) : value;
  }
  return out as Partial<FlowMove>;
}

const LOOSE_PROJECT = '__loose';

/** Resolves to the fallback if the promise fails or takes longer than 6s. */
function within<T> ( p: Promise<T>, fallback: T, ms = 6000 ): Promise<T> {
  return Promise.race( [p.catch( () => fallback ), new Promise<T>( resolve => setTimeout( () => resolve( fallback ), ms ) )] );
}

/**
 * One store for every flow-map screen. Signed out (or ?demo=1) it holds the
 * design's sample team in memory; signed in it maps the tenant's real
 * moves, projects and members. Decisions go to /api/moves/flow as logged
 * actions - the server applies them, records what each move looked like
 * before, and runs Undo (refusing when a move changed since). Rules,
 * dismissals, capacity and project details are stored there too.
 */
@Injectable( { providedIn: 'root' } )
export class FlowStore {
  private readonly auth = inject( MovesAuthService );
  private readonly tasks = inject( TaskApiService );
  private readonly data = inject( MovesDataService );
  private readonly admin = inject( MovesAdminService );
  private readonly prompts = inject( WriteAccessPromptService );
  private readonly writeAccess = inject( WriteAccessService );
  private readonly api = inject( FlowApiService );

  readonly mode = signal<'loading' | 'demo' | 'live'>( 'loading' );
  readonly error = signal( '' );
  readonly state = signal<FlowState>( demoState() );
  readonly range = signal<RangeKey>( '3w' );
  readonly toast = signal<FlowToast | null>( null );
  /** Whether TODD acts on its own. The demo shows it on. */
  readonly autonomy = signal<Autonomy>( { mode: 'on' } );
  /** Review items decided this session, in order - the left list keeps them ticked. */
  readonly reviewed = signal<string[]>( [] );

  readonly issues = computed( () => computeIssues( this.state() ) );
  readonly needsYou = computed( () => needsYou( this.issues() ) );
  readonly pm = computed( () => personById( this.state(), this.state().pmId ) );
  readonly isDemo = computed( () => this.mode() === 'demo' );
  /** Projects in rail order, with the loose bucket last. */
  readonly projects = computed( () => [...this.state().projects].sort( ( a, b ) => Number( a.id === LOOSE_PROJECT ) - Number( b.id === LOOSE_PROJECT ) ) );

  private writeState: WriteAccessState = 'signedOut';
  private tenantId = '';
  /** Local action id -> server id, for Undo buttons shown before the save came back. */
  private readonly serverIds = new Map<string, string>();
  private toastTimer?: ReturnType<typeof setTimeout>;
  private toastSeq = 0;
  private started = false;

  /** Called by the shell. Safe to call more than once. */
  start ( forceDemo = false ): void {
    if ( this.started && !forceDemo ) return;
    this.started = true;
    if ( forceDemo ) {
      this.useDemo();
      return;
    }
    this.auth.isLoggedIn().pipe( take( 1 ) ).subscribe( signedIn => {
      if ( !signedIn ) this.useDemo();
      else void this.loadLive();
    } );
    this.writeAccess.state( WRITE_ACCESS_APP.product ).subscribe( st => this.writeState = st );
  }

  resetDemo (): void {
    this.reviewed.set( [] );
    this.useDemo();
    this.say( 'Demo reset.' );
  }

  private useDemo (): void {
    this.state.set( demoState() );
    this.autonomy.set( { mode: 'on' } );
    this.mode.set( 'demo' );
  }

  // ------------------------------------------------------------ live data

  private async loadLive (): Promise<void> {
    this.mode.set( 'loading' );
    try {
      const user = await firstValueFrom( this.auth.getUser().pipe( filter( u => !!u ), take( 1 ) ) );
      const tenantId = await firstValueFrom( this.auth.getTenantId().pipe( filter( t => !!t ), take( 1 ) ) ).catch( () => user!.uid );
      this.tenantId = tenantId || user!.uid;
      const flowState = await this.loadFlowState();

      const [tasks, projectDocs, members, owner] = await Promise.all( [
        firstValueFrom( this.tasks.loadTasks( user!.uid ) ),
        // Projects and members are nice-to-have; a slow Firestore mustn't hold up the moves.
        within( this.data.getProjects( this.tenantId ), [] ),
        within( firstValueFrom( this.admin.getTenantMembers$( this.tenantId ) ), [] ),
        within( firstValueFrom( this.admin.getTenantOwnerUser$( this.tenantId ) ), null ),
      ] );

      const capacity = flowState?.capacity || {};
      const people = new Map<string, Person>();
      people.set( MAYA_ID, { id: MAYA_ID, name: 'Maya', initials: 'MA', role: 'Assistant · content', kind: 'maya', capacity: 6 } );
      people.set( TODD_ID, { id: TODD_ID, name: 'TODD', initials: 'TO', role: 'Assistant · admin', kind: 'todd', capacity: 10 } );
      const addPerson = ( id: string, name: string, role: string ) => {
        if ( !id || people.has( id ) ) return;
        const clean = ( name || 'Teammate' ).split( '@' )[0];
        people.set( id, { id, name: clean, role, kind: 'person', capacity: capacity[id] || 6, initials: clean.split( /[\s._-]+/ ).map( w => w[0] || '' ).join( '' ).slice( 0, 2 ).toUpperCase() } );
      };
      addPerson( user!.uid, user!.displayName || user!.email || 'You', 'Project lead' );
      if ( owner ) addPerson( owner.id, owner.displayName || owner.email, 'Owner' );
      for ( const m of members ) if ( m.status !== 'disabled' ) addPerson( m.id, m.displayName || m.email, m.role === 'admin' ? 'Admin' : 'Team' );

      const moves = tasks.filter( t => !t.superseded && !t.deleted && t.id ).map( t => this.toMove( t ) );
      for ( const m of moves ) if ( m.assigneeId && !people.has( m.assigneeId ) ) addPerson( m.assigneeId, 'Teammate', 'Team' );

      const details = new Map( ( flowState?.projects || [] ).map( p => [p.id, p] ) );
      const projects: FlowProject[] = projectDocs.map( p => ( { id: p.id, name: p.name || 'Untitled project', memberIds: [] } ) );
      for ( const m of moves ) {
        if ( !m.projectId ) m.projectId = LOOSE_PROJECT;
        if ( !projects.some( p => p.id === m.projectId ) ) {
          projects.push( { id: m.projectId, name: m.projectId === LOOSE_PROJECT ? 'Not in a project' : 'Untitled project', memberIds: [] } );
        }
      }
      for ( const p of projects ) {
        const d = details.get( p.id );
        const owners = [...new Set( moves.filter( m => m.projectId === p.id && m.assigneeId ).map( m => m.assigneeId! ) )];
        Object.assign( p, {
          memberIds: d?.memberIds.length ? d.memberIds : owners,
          shipsOn: d?.shipsOn || undefined, client: d?.client || undefined, value: d?.value || undefined,
          phases: d?.phases.length ? d.phases : undefined, leadId: d?.leadId || undefined,
        } );
      }

      this.state.set( {
        people: [...people.values()], projects: projects.filter( p => moves.some( m => m.projectId === p.id ) || p.id !== LOOSE_PROJECT ),
        moves,
        actions: [...( flowState?.actions || [] )].sort( ( a, b ) => a.createdAt.localeCompare( b.createdAt ) ),
        rules: defaultRules().map( r => ( { ...r, enabled: r.locked ? true : flowState?.rules.find( x => x.id === r.id )?.enabled ?? r.enabled } ) ),
        dismissed: Object.fromEntries( Object.entries( flowState?.dismissed || {} ).map( ( [id, d] ) => [id, { reason: d.reason, until: d.until || undefined }] ) ),
        now: new Date(), pmId: user!.uid,
      } );
      this.autonomy.set( flowState?.autonomy || { mode: 'dry_run' } );
      if ( !flowState ) this.error.set( 'TODD’s log and rules didn’t load. Changes you make now still save to your moves.' );
      this.mode.set( 'live' );
    } catch ( err ) {
      console.warn( '[FlowStore] live load failed', err );
      this.error.set( 'Moves couldn’t load your projects. Refresh to try again.' );
      this.mode.set( 'live' );
    }
  }

  /**
   * TODD's log, rules, dismissals, capacity and project details. The first
   * time, anything this browser kept from before the server stored them is
   * uploaded and cleared.
   */
  private async loadFlowState (): Promise<ServerFlowState | null> {
    const state = await within( this.api.state(), null, 8000 );
    if ( !state ) return null;
    const key = `moves-flow:${this.tenantId}`;
    let legacy: LegacyLocal | null = null;
    try {
      legacy = JSON.parse( localStorage.getItem( key ) || 'null' ) as LegacyLocal | null;
    } catch { }
    if ( !legacy ) return state;
    if ( state.imported ) {
      try { localStorage.removeItem( key ); } catch { }
      return state;
    }
    try {
      await this.api.importLocal( legacy );
      try { localStorage.removeItem( key ); } catch { }
      return await within( this.api.state(), state, 8000 );
    } catch ( err ) {
      console.warn( '[FlowStore] legacy import failed; will retry next load', err );
      return state;
    }
  }

  private toMove ( t: Task ): FlowMove {
    const lane: Lane = t.executionLane === 'maya' || t.employeeType === 'maya' ? 'maya' : t.executionLane === 'todd' ? 'todd' : 'person';
    // Moves from before nextAction existed fall back to the first line of their description.
    const description = String( t.description || '' ).replace( /<[^>]+>/g, ' ' ).trim();
    return {
      id: t.id!,
      projectId: t.projectId || '',
      title: t.title || 'Untitled move',
      nextAction: t.nextAction || description.split( /\n|(?<=\.)\s/ )[0] || '',
      assigneeId: lane === 'person' ? ( t.assigneeId || t.ownerId || null ) : null,
      lane,
      due: apiDay( t.dueDate || t.plannedForDate ) || isoDay( new Date() ),
      done: !!t.isCompleted || t.status === 'completed' || t.status === 'done',
      dependsOn: t.dependsOn || [],
      lastActivityAt: t.lastActivityAt || t.updatedAt || t.createdAt || new Date().toISOString(),
      dateLockedBy: t.dateLockedBy || undefined,
      dateLockedById: t.dateLockedById || undefined,
      // Older moves have no laneEnteredAt; like the server, count from when they were created.
      laneEnteredAt: t.laneEnteredAt || ( lane !== 'person' ? t.createdAt : '' ) || undefined,
      laneNotes: t.laneNotes && Object.keys( t.laneNotes ).length ? t.laneNotes : undefined,
      createdBy: t.createdByTodd ? 'todd' : t.employeeType === 'maya' ? 'maya' : 'person',
      history: [
        ...( t.createdAt ? [{ at: t.createdAt, text: `Created${t.createdByTodd ? ' by TODD' : ''}`, by: 'system' as const }] : [] ),
        ...( t.notesLog || [] ).map( n => ( { at: n.at, text: `${n.author === 'maya' ? 'Maya' : n.authorLabel || 'Note'}: “${n.text}”`, by: n.author === 'maya' ? 'maya' as const : 'person' as const } ) ),
      ],
    };
  }

  /** Moves the server sent back after an action or Undo replace the local copies. */
  private applyServerTasks ( tasks: Task[] ): void {
    if ( !tasks.length ) return;
    this.state.update( s => {
      const fresh = new Map( tasks.map( t => [t.id!, this.toMove( t )] ) );
      return {
        ...s,
        moves: s.moves.map( m => {
          const f = fresh.get( m.id );
          // Keep the bucket and the local history (notes) the list view built.
          return f ? { ...f, projectId: f.projectId || m.projectId, history: m.history } : m;
        } ),
      };
    } );
  }

  /** In live mode, stop and show the sign-in / subscribe prompt unless this account can write. */
  private canWrite ( action: string ): boolean {
    if ( this.mode() !== 'live' ) return true;
    if ( this.writeState === 'canWrite' || ( this.writeState === 'browsing' && this.prompts.unlocked ) ) return true;
    this.prompts.open( { state: this.writeState, action } );
    return false;
  }

  // --------------------------------------------------------------- toast

  say ( msg: string, undo?: () => void ): void {
    clearTimeout( this.toastTimer );
    this.toast.set( { id: ++this.toastSeq, msg, undo } );
    this.toastTimer = setTimeout( () => this.toast.set( null ), 5000 );
  }

  dismissToast (): void {
    clearTimeout( this.toastTimer );
    this.toast.set( null );
  }

  // ----------------------------------------------------------- mutations

  /** Applies one side of a set of changes to the local moves (screens update at once). */
  private patchMoves ( changes: MoveChange[], side: 'before' | 'after' ): void {
    this.state.update( s => {
      let moves = [...s.moves];
      for ( const c of changes ) {
        const patch = c[side];
        if ( patch === null ) moves = moves.filter( m => m.id !== c.moveId );
        else if ( Object.keys( patch ).length ) moves = moves.map( m => m.id === c.moveId ? { ...m, ...patch } : m );
      }
      return { ...s, moves };
    } );
  }

  private record ( a: Omit<ToddAction, 'id' | 'createdAt'> ): ToddAction {
    const action: ToddAction = { ...a, id: `act-${Date.now().toString( 36 )}-${Math.random().toString( 36 ).slice( 2, 6 )}`, createdAt: new Date().toISOString() };
    this.state.update( s => ( { ...s, actions: [...s.actions, action] } ) );
    return action;
  }

  /** Runs changes and logs them as one action, so Undo puts it all back. Live, the server applies and logs it. */
  private act ( type: ToddActionType, move: FlowMove, changes: MoveChange[], copy: { subject: string; text: string; note?: string; title?: string; reason: string } ): ToddAction {
    this.patchMoves( changes, 'after' );
    const action = this.record( { type, moveId: move.id, projectId: move.projectId, auto: false, changes, ...copy } );
    if ( this.mode() === 'live' ) void this.saveAction( action );
    return action;
  }

  private async saveAction ( local: ToddAction ): Promise<void> {
    try {
      const { action, tasks } = await this.api.record( {
        type: local.type, moveId: local.moveId, projectId: local.projectId === LOOSE_PROJECT ? '' : local.projectId,
        subject: local.subject, text: local.text, note: local.note, title: local.title, reason: local.reason,
        changes: local.changes.filter( c => c.after ).map( c => ( { moveId: c.moveId, after: flowPatch( c.after! ) } ) ),
      } );
      this.serverIds.set( local.id, action.id );
      this.state.update( s => ( { ...s, actions: s.actions.map( a => a.id === local.id ? { ...local, ...action, changes: action.changes } : a ) } ) );
      this.applyServerTasks( tasks );
    } catch ( err ) {
      // Put the screens back and drop the action - nothing was saved.
      this.patchMoves( [...local.changes].reverse(), 'before' );
      this.state.update( s => ( { ...s, actions: s.actions.filter( a => a.id !== local.id ) } ) );
      this.say( FlowApiService.message( err, 'That didn’t save. Check your connection and try again.' ) );
    }
  }

  undo ( actionId: string ): void {
    const id = this.serverIds.get( actionId ) || actionId;
    const a = this.state().actions.find( x => x.id === id );
    if ( !a || a.undoneAt || !this.canWrite( 'undo this' ) ) return;
    if ( this.mode() === 'live' ) {
      if ( a.id.startsWith( 'act-' ) && !this.serverIds.has( a.id ) ) {
        this.say( 'Still saving that. Try Undo again in a second.' );
        return;
      }
      void this.undoOnServer( a );
      return;
    }
    this.patchMoves( [...a.changes].reverse(), 'before' );
    this.markUndone( a.id );
    this.sayUndone( a );
  }

  private async undoOnServer ( a: ToddAction ): Promise<void> {
    try {
      const { action, tasks } = await this.api.undo( a.id );
      this.state.update( s => ( { ...s, moves: s.moves.filter( m => !a.changes.some( c => c.before === null && c.moveId === m.id ) ) } ) );
      this.applyServerTasks( tasks );
      this.markUndone( a.id, action.undoneAt );
      this.sayUndone( a );
    } catch ( err ) {
      this.say( FlowApiService.message( err, 'Undo didn’t go through. Try again.' ) );
    }
  }

  private markUndone ( id: string, at = new Date().toISOString() ): void {
    this.state.update( s => ( { ...s, actions: s.actions.map( x => x.id === id ? { ...x, undoneAt: at } : x ) } ) );
  }

  private sayUndone ( a: ToddAction ): void {
    const m = moveById( this.state(), a.moveId );
    const back = a.type === 'reassigned' && m ? ` ${m.title} is back with ${firstName( ownerOf( this.state(), m ) )}.` : ' TODD put it back the way it was.';
    this.say( `Undone.${back}` );
  }

  assign ( moveId: string, personId: string, why = '' ): void {
    const s = this.state();
    const m = moveById( s, moveId );
    const p = personById( s, personId );
    if ( !m || !p || !this.canWrite( 'assign this move' ) ) return;
    const from = ownerOf( s, m );
    const lane: Lane = p.kind;
    const a = this.act( m.assigneeId || m.lane !== 'person' ? 'reassigned' : 'assigned', m, [{
      moveId, before: { assigneeId: m.assigneeId, lane: m.lane, lastActivityAt: m.lastActivityAt },
      after: { assigneeId: lane === 'person' ? p.id : null, lane, lastActivityAt: new Date().toISOString(), laneEnteredAt: lane === 'person' ? undefined : new Date().toISOString() },
    }], {
      subject: m.title,
      text: from ? `from ${firstName( from )} to ${firstName( p )}.${why ? ' ' + why : ''}` : `to ${firstName( p )}.${why ? ' ' + why : ''}`,
      note: `Gave ${m.title} to ${firstName( p )}.`, title: `${m.title} is ${firstName( p )}’s`,
      reason: why || 'You decided.',
    } );
    const told = this.isDemo() ? ` TODD told ${firstName( p )} by push.` : '';
    this.say( `${m.title} is now ${firstName( p )}’s.${told}`, () => this.undo( a.id ) );
  }

  reschedule ( moveIds: string[], days: number ): void {
    const s = this.state();
    const moves = moveIds.map( id => moveById( s, id ) ).filter( ( m ): m is FlowMove => !!m );
    if ( !moves.length || !this.canWrite( 'change the date' ) ) return;
    const changes = moves.map( m => ( { moveId: m.id, before: { due: m.due }, after: { due: isoDay( addDays( m.due, days ) ) } } ) );
    const a = this.act( 'rescheduled', moves[0], changes, {
      subject: moves.length === 1 ? moves[0].title : `${moves.length} moves`,
      text: `to ${fmtDay( changes[0].after.due )}.`, reason: 'You decided.',
    } );
    this.say( `${moves.length === 1 ? moves[0].title + ' moved' : moves.length + ' moves moved'} to ${fmtWeekday( changes[0].after.due )} ${fmtDay( changes[0].after.due )}.`, () => this.undo( a.id ) );
  }

  applySequence ( issueId: string ): void {
    const s = this.state();
    const issue = this.issues().find( i => i.id === issueId );
    const p = issue && sequenceProposal( s, issue );
    if ( !issue || !p || !this.canWrite( 'change the order' ) ) return;
    const a = moveById( s, issue.moveIds[0] )!;
    const b = moveById( s, issue.moveIds[1] )!;
    const changes = p.changes.map( c => c.moveId === a.id && a.dateLockedBy === 'manual' ? { ...c, before: { ...c.before, dateLockedBy: a.dateLockedBy }, after: { ...c.after, dateLockedBy: undefined } } : c );
    const action = this.act( 'sequenced', a, changes, {
      subject: `${b.title} first`, text: `— swapped with ${a.title.toLowerCase()}.`, title: `${b.title} moved before ${a.title.toLowerCase()}`,
      note: `Swapped ${b.title.toLowerCase()} and ${a.title.toLowerCase()}.`, reason: p.why,
    } );
    const names = p.notify.map( firstName ).join( ' and ' );
    this.say( `Order swapped.${this.isDemo() && names ? ` TODD told ${names}.` : ''}`, () => this.undo( action.id ) );
  }

  dismiss ( issueId: string, reason: Dismissal['reason'] ): void {
    const until = reason === 'keep' ? undefined : addDays( new Date(), 1 ).toISOString();
    const before = this.state().dismissed[issueId];
    this.state.update( s => ( { ...s, dismissed: { ...s.dismissed, [issueId]: { reason, until } } } ) );
    this.sync( this.api.dismiss( issueId, reason, until ), () => this.setDismissal( issueId, before ) );
  }

  undismiss ( issueId: string ): void {
    const before = this.state().dismissed[issueId];
    this.setDismissal( issueId, undefined );
    this.sync( this.api.undismiss( issueId ), () => this.setDismissal( issueId, before ) );
  }

  private setDismissal ( issueId: string, value: Dismissal | undefined ): void {
    this.state.update( s => {
      const dismissed = { ...s.dismissed };
      if ( value ) dismissed[issueId] = value;
      else delete dismissed[issueId];
      return { ...s, dismissed };
    } );
  }

  /** Live only: send a settings change; on failure put the screen back and say so. */
  private sync ( call: Promise<unknown>, revert: () => void ): void {
    if ( this.mode() !== 'live' ) {
      call.catch( () => null );
      return;
    }
    call.catch( err => {
      revert();
      this.say( FlowApiService.message( err, 'That didn’t save. Try again.' ) );
    } );
  }

  markDone ( moveId: string ): void {
    const m = moveById( this.state(), moveId );
    if ( !m || !this.canWrite( 'mark this done' ) ) return;
    const a = this.act( 'completed', m, [{ moveId, before: { done: m.done, lastActivityAt: m.lastActivityAt }, after: { done: true, lastActivityAt: new Date().toISOString() } }], {
      subject: m.title, text: 'marked done.', reason: 'Owner marked it done.',
    } );
    const waiting = this.state().moves.filter( x => x.dependsOn.includes( moveId ) && !x.done );
    const next = waiting[0] ? ` ${firstName( ownerOf( this.state(), waiting[0] ) )} can start ${waiting[0].title.toLowerCase()}.` : '';
    this.say( `Marked done.${next}`, () => this.undo( a.id ) );
  }

  /** "Can't do it" from the member's phone: TODD routes it again to whoever has the most room. */
  cantDo ( moveId: string, reason: 'someone-else' | 'blocked' | 'not-this-week' ): void {
    const s = this.state();
    const m = moveById( s, moveId );
    if ( !m || !this.canWrite( 'hand this back' ) ) return;
    const from = ownerOf( s, m );
    if ( reason === 'not-this-week' && !m.dateLockedBy ) {
      const due = isoDay( addDays( m.due, 7 ) );
      const a = this.act( 'rescheduled', m, [{ moveId, before: { due: m.due }, after: { due } }], {
        subject: m.title, text: `a week later. ${firstName( from )} can’t get to it this week.`, reason: 'Owner said not this week.',
      } );
      this.say( `Moved to ${fmtDay( due )}. TODD will tell ${firstName( this.pm() )} because the date moved.`, () => this.undo( a.id ) );
      return;
    }
    const to = byRoom( s, m.projectId, [from?.id || ''] )[0];
    if ( !to ) {
      this.say( 'Sent back to TODD. Nobody else on the project has room yet.' );
      return;
    }
    const why = reason === 'blocked' ? `${firstName( from )} is blocked.` : `${firstName( from )} said someone else should.`;
    const a = this.act( 'reassigned', m, [{ moveId, before: { assigneeId: m.assigneeId, lane: m.lane }, after: { assigneeId: to.id, lane: 'person' } }], {
      subject: m.title, text: `from ${firstName( from )} to ${firstName( to )}. ${why}`, reason: why,
    } );
    this.say( 'Sent back to TODD. It will find another owner.', () => this.undo( a.id ) );
  }

  updateNextAction ( moveId: string, nextAction: string ): void {
    const m = moveById( this.state(), moveId );
    if ( !m || m.nextAction === nextAction || !this.canWrite( 'save the next action' ) ) return;
    const change: MoveChange = { moveId, before: { nextAction: m.nextAction }, after: { nextAction } };
    this.patchMoves( [change], 'after' );
    if ( this.mode() !== 'live' ) {
      this.say( 'Next action saved.' );
      return;
    }
    this.tasks.updateTask( moveId, { nextAction }, this.state().pmId )
      .then( () => this.say( 'Next action saved.' ) )
      .catch( err => {
        this.patchMoves( [change], 'before' );
        this.say( FlowApiService.message( err, 'That didn’t save. Try again.' ) );
      } );
  }

  async addNote ( moveId: string, text: string ): Promise<void> {
    const m = moveById( this.state(), moveId );
    if ( !m || !text.trim() || !this.canWrite( 'leave a note' ) ) return;
    const entry = { at: new Date().toISOString(), text: `${firstName( this.pm() )}: “${text.trim()}”`, by: 'person' as const };
    this.state.update( s => ( { ...s, moves: s.moves.map( x => x.id === moveId ? { ...x, history: [...x.history, entry] } : x ) } ) );
    if ( this.mode() === 'live' ) {
      try {
        await this.tasks.addTaskNote( moveId, text.trim() );
      } catch {
        this.say( 'That note didn’t save. Try again.' );
        return;
      }
    }
    this.say( `Note left for ${firstName( ownerOf( this.state(), m ) )}.` );
  }

  setRule ( ruleId: string, enabled: boolean ): void {
    if ( !this.canWrite( 'change TODD’s rules' ) ) return;
    const flip = ( on: boolean ) => this.state.update( s => ( { ...s, rules: s.rules.map( r => r.id === ruleId && !r.locked ? { ...r, enabled: on } : r ) } ) );
    flip( enabled );
    this.sync( this.api.setRule( ruleId, enabled ), () => flip( !enabled ) );
  }

  /** Turn TODD on, pause it, or send it back to practising. */
  setAutonomy ( mode: Autonomy['mode'] ): void {
    if ( !this.canWrite( 'change what TODD does on its own' ) ) return;
    const before = this.autonomy();
    this.autonomy.set( { ...before, mode, chosenBy: this.state().pmId } );
    const said = { on: 'TODD is on. It acts within its rules and logs everything with Undo.', off: 'TODD is paused. It still flags breaks; it just won’t act.', dry_run: 'TODD is practising. It logs what it would do and changes nothing.' }[mode];
    if ( this.mode() !== 'live' ) {
      this.say( said );
      return;
    }
    this.api.setAutonomy( mode )
      .then( a => {
        this.autonomy.set( a );
        this.say( said );
      } )
      .catch( err => {
        this.autonomy.set( before );
        this.say( FlowApiService.message( err, 'That didn’t save. Try again.' ) );
      } );
  }

  /** How many open moves someone can carry before Team shows them full. */
  setCapacity ( personId: string, capacity: number ): void {
    const p = personById( this.state(), personId );
    if ( !p || p.kind !== 'person' || !this.canWrite( 'change capacity' ) ) return;
    const set = ( n: number ) => this.state.update( s => ( { ...s, people: s.people.map( x => x.id === personId ? { ...x, capacity: n } : x ) } ) );
    const before = p.capacity;
    set( capacity );
    this.sync( this.api.setCapacity( personId, capacity ), () => set( before ) );
  }

  /** Runs one of an issue's choices - shared by Momentum, Diagnosis, TODD, Review and the digest. */
  run ( choice: IssueChoice, issue?: Issue ): void {
    const r = choice.run;
    switch ( r.kind ) {
      case 'assign': this.assign( r.moveId, r.personId ); break;
      case 'sequence': this.applySequence( r.issueId ); break;
      case 'keep': this.dismiss( r.issueId, 'keep' ); this.say( issue?.kind === 'order' ? 'Kept the current order. TODD won’t flag it again.' : 'Kept. TODD won’t flag it again.', () => this.undismiss( r.issueId ) ); break;
      case 'park': this.dismiss( r.issueId, 'park' ); this.say( 'Parked for standup.', () => this.undismiss( r.issueId ) ); break;
      case 'skip': this.dismiss( r.issueId, 'skip' ); this.say( 'TODD will ask again tomorrow.', () => this.undismiss( r.issueId ) ); break;
      case 'reschedule': this.reschedule( r.moveIds, r.days ); break;
      case 'open': break;
    }
  }

  // ------------------------------------------------------------ projects

  async createProject ( draft: PlanDraft ): Promise<string | null> {
    if ( !this.canWrite( 'create this project' ) ) return null;
    const s = this.state();
    let projectId = `p-${Date.now().toString( 36 )}`;
    if ( this.mode() === 'live' ) {
      try {
        projectId = await this.data.addDropdownItem( this.tenantId, 'projects', { id: '', name: draft.name } );
      } catch {
        this.say( 'Moves couldn’t create the project. Try again.' );
        return null;
      }
    }
    // Indexed by plan position, so a move that failed to save doesn't shift later dependsOn.
    const idAt: ( string | undefined )[] = [];
    const moves: FlowMove[] = [];
    let failed = 0;
    for ( const [i, d] of draft.moves.entries() ) {
      const dependsOn = d.dependsOn.map( n => idAt[n] ).filter( ( x ): x is string => !!x );
      let id = `${projectId}-${i}`;
      if ( this.mode() === 'live' ) {
        const saved = await this.tasks.addTask( {
          title: d.title, description: d.nextAction, nextAction: d.nextAction, dueDate: d.due, progress: 0, status: 'not-started', projectId,
          assigneeId: d.ownerId || undefined, executionLane: d.lane, dependsOn,
        } as Task, s.pmId ).catch( () => null );
        if ( !saved?.id ) {
          failed++;
          continue;
        }
        id = saved.id;
      }
      idAt[i] = id;
      moves.push( {
        id, projectId, title: d.title, nextAction: d.nextAction, assigneeId: d.lane === 'person' ? d.ownerId : null, lane: d.lane, due: d.due, done: false,
        dependsOn, lastActivityAt: new Date().toISOString(),
        laneEnteredAt: d.lane === 'person' ? undefined : new Date().toISOString(), createdBy: 'person', history: [{ at: new Date().toISOString(), text: 'Created from a pasted plan', by: 'system' }],
      } );
    }
    const memberIds = [...new Set( moves.map( m => m.assigneeId ).filter( ( x ): x is string => !!x ) )];
    const project: FlowProject = { id: projectId, name: draft.name, shipsOn: draft.launch, memberIds, leadId: s.pmId };
    if ( this.mode() === 'live' ) {
      await this.api.updateProject( projectId, { shipsOn: draft.launch, memberIds, leadId: s.pmId } ).catch( () => null );
    }
    this.state.update( st => ( { ...st, projects: [...st.projects, project], moves: [...st.moves, ...moves] } ) );
    if ( failed ) {
      this.say( `${draft.name} is on the board, but ${failed} move${failed === 1 ? '' : 's'} didn’t save. Add ${failed === 1 ? 'it' : 'them'} from the project.` );
      return projectId;
    }
    this.say( `${draft.name} is on the board. TODD is watching it.` );
    return projectId;
  }

  project ( id: string ): FlowProject | undefined {
    return projectById( this.state(), id );
  }
}

export { LOOSE_PROJECT };
