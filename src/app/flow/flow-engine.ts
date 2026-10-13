import { addDays, daysBetween, fmtDay, fmtTime, fmtWeekday, fmtWeekdayDay, isoDay, startOfDay, toDate } from './flow-dates';
import { FlowMove, FlowProject, Issue, IssueChoice, MoveChange, NodeKind, Person, RangeKey, ToddAction, ToddRule, TrackModel, TrackNode } from './flow.models';

/**
 * The flow-map engine: pure functions from moves, people, rules and the
 * TODD log to issues, tracks and proposals. Every screen reads from here,
 * so a fix made on one view shows up on all of them.
 */

export interface Dismissal { reason: 'keep' | 'skip' | 'park'; until?: string }

export interface FlowState {
  people: Person[];
  projects: FlowProject[];
  moves: FlowMove[];
  actions: ToddAction[];
  rules: ToddRule[];
  dismissed: Record<string, Dismissal>;
  now: Date;
  /** The project lead using the app. */
  pmId: string;
}

export const TODD_ID = 'todd';
export const MAYA_ID = 'maya';

export function defaultRules (): ToddRule[] {
  return [
    { id: 'handoff', lead: 'Hand off what Maya and I can’t do.', text: 'Or anything that sits 48h in our lane. It goes to the person on the project with the most room.', enabled: true, locked: false, params: { hours: 48 } },
    { id: 'nudge', lead: 'Nudge the owner', text: 'after 4 days of no activity.', enabled: true, locked: false, params: { days: 4 } },
    { id: 'reschedule', lead: 'Reschedule', text: 'internal dates within slack.', enabled: true, locked: false },
    { id: 'split', lead: 'Split a move', text: 'when part of it is Maya’s work.', enabled: true, locked: false },
    { id: 'lock-dates', lead: 'Never', text: 'move a client-facing date or a date someone set by hand.', enabled: true, locked: true },
    { id: 'no-outside', lead: 'Never', text: 'message anyone outside the team.', enabled: true, locked: true },
  ];
}

// ---------------------------------------------------------------- lookups

export function personById ( s: FlowState, id: string | null | undefined ): Person | undefined {
  return id ? s.people.find( p => p.id === id ) : undefined;
}

export function firstName ( p: Person | undefined ): string {
  return p ? p.name.split( ' ' )[0] : 'Nobody';
}

export function projectById ( s: FlowState, id: string ): FlowProject | undefined {
  return s.projects.find( p => p.id === id );
}

export function moveById ( s: FlowState, id: string ): FlowMove | undefined {
  return s.moves.find( m => m.id === id );
}

export function projectMoves ( s: FlowState, projectId: string ): FlowMove[] {
  return s.moves.filter( m => m.projectId === projectId ).sort( byDue );
}

export function byDue ( a: FlowMove, b: FlowMove ): number {
  return toDate( a.due ).getTime() - toDate( b.due ).getTime();
}

function rule ( s: FlowState, id: string ): ToddRule | undefined {
  return s.rules.find( r => r.id === id );
}

export function ruleOn ( s: FlowState, id: string ): boolean {
  return !!rule( s, id )?.enabled;
}

/** Who carries the move right now: the assignee, or the TODD/Maya lane. */
export function ownerOf ( s: FlowState, m: FlowMove ): Person | undefined {
  if ( m.lane === 'maya' ) return personById( s, MAYA_ID );
  if ( m.lane === 'todd' ) return personById( s, TODD_ID );
  return personById( s, m.assigneeId );
}

export function isOpen ( m: FlowMove ): boolean {
  return !m.done;
}

export function daysStill ( s: FlowState, m: FlowMove ): number {
  return Math.max( 0, daysBetween( m.lastActivityAt, s.now ) );
}

/** Open moves on someone's plate, overdue ones included, due within the window. */
export function loadOf ( s: FlowState, personId: string, windowDays = 14 ): FlowMove[] {
  const end = addDays( s.now, windowDays );
  return s.moves.filter( m => isOpen( m ) && ownerOf( s, m )?.id === personId && toDate( m.due ) <= end );
}

export function roomFor ( s: FlowState, personId: string ): number {
  const p = personById( s, personId );
  return p ? p.capacity - loadOf( s, personId ).length : 0;
}

/** People on the project ordered by most room first. TODD and Maya never count. */
export function byRoom ( s: FlowState, projectId: string, exclude: string[] = [] ): Person[] {
  const project = projectById( s, projectId );
  const people = s.people.filter( p => p.kind === 'person' && !exclude.includes( p.id ) );
  // The PM is the one deciding, so only suggest them when nobody else is left.
  const others = people.filter( p => p.id !== s.pmId );
  const pool = others.length ? others : people;
  const onProject = project ? pool.filter( p => project.memberIds.includes( p.id ) ) : [];
  const candidates = onProject.length ? onProject : pool;
  return [...candidates].sort( ( a, b ) => roomFor( s, b.id ) - roomFor( s, a.id ) || a.name.localeCompare( b.name ) );
}

/** Every move that waits on this one, directly or down the chain. */
export function downstream ( s: FlowState, moveId: string ): FlowMove[] {
  const out = new Map<string, FlowMove>();
  const walk = ( id: string ) => {
    for ( const m of s.moves ) {
      if ( m.dependsOn.includes( id ) && !out.has( m.id ) ) {
        out.set( m.id, m );
        walk( m.id );
      }
    }
  };
  walk( moveId );
  return [...out.values()];
}

/** Actions that really changed something and still stand (not undone, not practice). */
export function liveActions ( s: FlowState ): ToddAction[] {
  return s.actions.filter( a => !a.undoneAt && !a.dryRun );
}

/** The latest action TODD took today that touched this move and wasn't undone. */
export function todaysActionOn ( s: FlowState, moveId: string ): ToddAction | undefined {
  return liveActions( s )
    .filter( a => daysBetween( a.createdAt, s.now ) === 0 && ( a.moveId === moveId || a.changes.some( c => c.moveId === moveId ) ) )
    .sort( ( a, b ) => b.createdAt.localeCompare( a.createdAt ) )[0];
}

function isDismissed ( s: FlowState, id: string ): boolean {
  const d = s.dismissed[id];
  if ( !d ) return false;
  return !d.until || toDate( d.until ) > s.now;
}

export function isParked ( s: FlowState, id: string ): boolean {
  return s.dismissed[id]?.reason === 'park' && isDismissed( s, id );
}

// ----------------------------------------------------------------- issues

export function computeIssues ( s: FlowState ): Issue[] {
  const issues: Issue[] = [];
  const nudgeDays = rule( s, 'nudge' )?.params?.['days'] ?? 4;

  for ( const m of s.moves ) {
    if ( !isOpen( m ) ) continue;
    const project = projectById( s, m.projectId );

    // Gap: no owner.
    if ( m.lane === 'person' && !m.assigneeId ) {
      issues.push( gapOwnerIssue( s, m, project ) );
      continue;
    }

    // Gap: no next action.
    if ( !m.nextAction.trim() ) {
      issues.push( gapNextIssue( s, m ) );
    }

    // Order: set before something it waits on.
    for ( const depId of m.dependsOn ) {
      const dep = moveById( s, depId );
      if ( dep && isOpen( dep ) && toDate( m.due ) < toDate( dep.due ) ) {
        issues.push( orderIssue( s, m, dep ) );
      }
    }

    // Stall: sitting too long in TODD's or Maya's lane - unless it's waiting
    // on another open move (Maya's part after a split), which isn't stuck.
    const handoffHours = rule( s, 'handoff' )?.params?.['hours'] ?? 48;
    const waiting = m.dependsOn.some( id => { const d = moveById( s, id ); return !!d && isOpen( d ); } );
    if ( m.lane !== 'person' && !waiting && m.laneEnteredAt && ( s.now.getTime() - toDate( m.laneEnteredAt ).getTime() ) / 3_600_000 >= handoffHours ) {
      issues.push( laneStallIssue( s, m ) );
      continue;
    }

    // Stall: a person's move with no activity.
    const still = daysStill( s, m );
    if ( m.lane === 'person' && still >= nudgeDays && daysBetween( s.now, m.due ) <= 14 ) {
      issues.push( stallIssue( s, m, still, nudgeDays ) );
    }
  }

  // Pile-up: Maya's past-due moves stacking at today.
  const mayaLate = s.moves.filter( m => isOpen( m ) && m.lane === 'maya' && daysBetween( m.due, s.now ) > 0 );
  if ( mayaLate.length >= 2 ) issues.push( pileupIssue( s, mayaLate ) );

  // Capacity: a person carrying more than they can next week.
  for ( const p of s.people ) {
    if ( p.kind !== 'person' ) continue;
    const load = loadOf( s, p.id );
    if ( load.length > p.capacity ) issues.push( capacityIssue( s, p, load ) );
  }

  // Fixed: what TODD did today, so Diagnosis shows it with Undo.
  for ( const a of liveActions( s ) ) {
    if ( !a.auto || daysBetween( a.createdAt, s.now ) !== 0 ) continue;
    const kind = a.type === 'rescheduled' || a.type === 'sequenced' ? 'order' : a.type === 'nudged' ? null : 'gap';
    if ( !kind ) continue;
    issues.push( {
      id: `fixed:${a.id}`, kind, status: 'fixed', projectId: a.projectId, moveIds: [a.moveId],
      label: a.subject, title: a.title || `${a.subject} ${a.text}`, explanation: a.reason, question: '', consequence: '', choices: [],
    } );
  }

  return issues
    .filter( i => i.status === 'fixed' || !isDismissed( s, i.id ) || isParked( s, i.id ) )
    .map( i => isParked( s, i.id ) ? { ...i, status: 'watching' as const } : i );
}

function assignChoices ( s: FlowState, m: FlowMove, exclude: string[] = [] ): IssueChoice[] {
  const ranked = byRoom( s, m.projectId, exclude );
  return ranked.slice( 0, 2 ).map( ( p, i ) => ( {
    label: firstName( p ),
    hint: i === 0 ? `Most room · ${loadOf( s, p.id ).length} open` : `${plural( loadOf( s, p.id, 7 ).length, 'move' )} this week`,
    run: { kind: 'assign' as const, moveId: m.id, personId: p.id },
  } ) );
}

function talkSkip ( id: string ): IssueChoice[] {
  return [
    { label: 'Talk it through', hint: 'Park for standup', run: { kind: 'park', issueId: id } },
    { label: 'Skip', hint: 'Ask again tomorrow', run: { kind: 'skip', issueId: id } },
  ];
}

function gapOwnerIssue ( s: FlowState, m: FlowMove, project: FlowProject | undefined ): Issue {
  const id = `gap:owner:${m.id}`;
  const waiting = downstream( s, m.id ).filter( isOpen ).length;
  const best = byRoom( s, m.projectId )[0];
  const lanes = m.laneNotes?.todd && m.laneNotes?.maya ? `I can’t do this and neither can Maya.` : 'This needs a person.';
  const slips = project?.shipsOn && waiting > 0;
  return {
    id, kind: 'gap', status: 'needs_you', projectId: m.projectId, moveIds: [m.id],
    label: `${m.title} owner`,
    title: `${m.title} has no owner`,
    explanation: best ? `${lanes} ${firstName( best )} has the most room on this project this week.` : lanes,
    question: waiting ? `${m.title} has no owner, and ${waiting} move${waiting === 1 ? ' is' : 's are'} waiting on it.` : `${m.title} has no owner.`,
    consequence: slips
      ? `Launch slips from ${fmtDay( project!.shipsOn! )} to ${fmtDay( addDays( project!.shipsOn!, 7 ) )} if nobody owns this by ${fmtWeekday( m.due )}. ${m.laneNotes?.todd && m.laneNotes?.maya ? 'TODD and Maya can’t do it.' : ''}`.trim()
      : `It’s due ${fmtWeekdayDay( m.due )}. Nothing after it can start until someone owns it.`,
    choices: [...assignChoices( s, m ), ...talkSkip( id )],
  };
}

function gapNextIssue ( s: FlowState, m: FlowMove ): Issue {
  const id = `gap:next:${m.id}`;
  const owner = ownerOf( s, m );
  return {
    id, kind: 'gap', status: 'needs_you', projectId: m.projectId, moveIds: [m.id],
    label: `${m.title} has no next action`,
    title: `${m.title} has no next action`,
    explanation: `${firstName( owner )} owns it, but nobody wrote down what happens next. Without one I can’t tell if it’s moving.`,
    question: `${m.title} has no next action.`,
    consequence: `It’s due ${fmtWeekdayDay( m.due )}. What has to happen first?`,
    choices: [{ label: 'Write it', hint: 'Open the move', run: { kind: 'open', moveId: m.id } }, ...talkSkip( id )],
  };
}

function orderIssue ( s: FlowState, m: FlowMove, dep: FlowMove ): Issue {
  const id = `order:${m.id}:${dep.id}`;
  const gap = daysBetween( m.due, dep.due );
  return {
    id, kind: 'order', status: 'needs_you', projectId: m.projectId, moveIds: [m.id, dep.id],
    label: `Swap ${dep.title.toLowerCase()} / ${m.title.toLowerCase()}`,
    title: `${m.title} is set before ${dep.title.toLowerCase()}`,
    explanation: `${m.title} needs ${dep.title.toLowerCase()}, which comes ${gap} day${gap === 1 ? '' : 's'} later. I can swap them.`,
    question: `${m.title} is set before ${dep.title.toLowerCase()}, which it waits on.`,
    consequence: `${m.title} needs ${dep.title.toLowerCase()}, which comes ${gap} day${gap === 1 ? '' : 's'} later.${m.orderNote ? ' ' + m.orderNote : ''}`,
    choices: [
      { label: 'Apply', hint: `${dep.title} first`, run: { kind: 'sequence', issueId: id } },
      { label: 'Keep order', hint: 'Don’t flag it again', run: { kind: 'keep', issueId: id } },
      ...talkSkip( id ),
    ],
  };
}

function stallIssue ( s: FlowState, m: FlowMove, still: number, nudgeDays: number ): Issue {
  const id = `stall:${m.id}`;
  const owner = ownerOf( s, m );
  const nudge = liveActions( s ).filter( a => a.type === 'nudged' && a.moveId === m.id ).sort( ( a, b ) => b.createdAt.localeCompare( a.createdAt ) )[0];
  const recent = todaysActionOn( s, m.id );
  const next = byRoom( s, m.projectId, [owner?.id || ''] )[0];
  const watching = ( !!nudge || !!recent ) && still < nudgeDays * 3;
  const choices: IssueChoice[] = [];
  if ( next ) choices.push( { label: firstName( next ), hint: `Most room · ${loadOf( s, next.id ).length} open`, run: { kind: 'assign', moveId: m.id, personId: next.id } } );
  if ( !m.dateLockedBy ) choices.push( { label: 'Push a week', hint: `Due ${fmtDay( addDays( m.due, 7 ) )}`, run: { kind: 'reschedule', moveIds: [m.id], days: 7 } } );
  return {
    id, kind: 'stall', status: watching ? 'watching' : 'needs_you', projectId: m.projectId, moveIds: [m.id], days: still,
    label: `${m.title}, ${still} days`,
    title: `${m.title}, still ${still} days`,
    explanation: recent && recent.type !== 'nudged'
      ? `${recent.subject} ${recent.text}`
      : nudge
        ? `Nudged ${firstName( owner )} at ${fmtTime( nudge.createdAt )}. If there’s no reply by tomorrow, I’ll offer it to ${firstName( next )}.`
        : `No activity for ${still} days. ${firstName( next )} has the most room if it should move.`,
    question: `${m.title} hasn’t moved in ${still} days.`,
    consequence: `${firstName( owner )} owns it and it’s due ${fmtWeekdayDay( m.due )}. ${downstream( s, m.id ).filter( isOpen ).length} moves wait on it.`,
    choices: [...choices, ...talkSkip( id )].slice( 0, 4 ),
  };
}

function laneStallIssue ( s: FlowState, m: FlowMove ): Issue {
  const id = `stall:lane:${m.id}`;
  const lane = m.lane === 'maya' ? 'Maya' : 'TODD';
  const days = Math.max( 1, daysBetween( m.laneEnteredAt!, s.now ) );
  const cant = m.laneNotes?.[m.lane];
  const to = byRoom( s, m.projectId )[0];
  return {
    id, kind: 'stall', status: 'needs_you', projectId: m.projectId, moveIds: [m.id], days,
    label: `${m.title}, ${days} days with ${lane}`,
    title: `${m.title}, ${days} days with ${lane}`,
    explanation: `${cant ? cant + ' ' : ''}It will stall again unless a person takes it.${to ? ` ${firstName( to )} has the most room.` : ''}`,
    question: `${m.title} has sat with ${lane} for ${days} days.`,
    consequence: `${cant || `${lane} hasn’t moved it.`} It’s due ${fmtWeekdayDay( m.due )}.`,
    choices: [...assignChoices( s, m ), ...talkSkip( id )],
  };
}

function pileupIssue ( s: FlowState, late: FlowMove[] ): Issue {
  const ids = late.map( m => m.id );
  const id = `pileup:maya:${ids.slice().sort().join( ',' )}`;
  return {
    id, kind: 'pileup', status: 'needs_you', projectId: late[0].projectId, moveIds: ids,
    label: `Maya: ${late.length} need a date`,
    title: `${late.length} of Maya’s moves need a new date`,
    explanation: `They came from her daily plans and are past due. I can’t pick a client-facing date.`,
    question: `${late.length} of Maya’s moves are past due.`,
    consequence: `${late.map( m => m.title ).join( ', ' )}. Maya can’t send them until someone sets a date.`,
    choices: [
      { label: 'Push a week', hint: `All ${late.length} to ${fmtDay( addDays( s.now, 7 ) )}`, run: { kind: 'reschedule', moveIds: ids, days: daysBetween( late[0].due, addDays( s.now, 7 ) ) } },
      { label: 'Look at them', hint: 'Open the first one', run: { kind: 'open', moveId: ids[0] } },
      ...talkSkip( id ),
    ],
  };
}

function capacityIssue ( s: FlowState, p: Person, load: FlowMove[] ): Issue {
  const id = `capacity:${p.id}`;
  const movable = [...load].filter( m => !m.dateLockedBy ).sort( byDue ).pop();
  const to = movable ? byRoom( s, movable.projectId, [p.id] )[0] : undefined;
  const choices: IssueChoice[] = [];
  if ( movable && to ) choices.push( { label: `${firstName( to )} takes one`, hint: movable.title, run: { kind: 'assign', moveId: movable.id, personId: to.id } } );
  return {
    id, kind: 'capacity', status: 'needs_you', projectId: movable?.projectId || load[0]?.projectId || '', moveIds: load.map( m => m.id ),
    label: `${firstName( p )} over capacity next week`,
    title: `${firstName( p )} is over capacity`,
    explanation: `${load.length} open moves against room for ${p.capacity}.${to ? ` ${firstName( to )} has the most room.` : ''}`,
    question: `${firstName( p )} has ${load.length} moves and room for ${p.capacity}.`,
    consequence: 'Something slips next week unless one of them moves.',
    choices: [...choices, { label: 'Keep it', hint: 'Don’t flag it again', run: { kind: 'keep' as const, issueId: id } }, ...talkSkip( id )].slice( 0, 4 ),
  };
}

export function needsYou ( issues: Issue[] ): Issue[] {
  const rank: Record<string, number> = { gap: 0, order: 1, pileup: 2, stall: 3, capacity: 4 };
  return issues.filter( i => i.status === 'needs_you' ).sort( ( a, b ) => rank[a.kind] - rank[b.kind] );
}

export function issuesForProject ( issues: Issue[], projectId: string ): Issue[] {
  return issues.filter( i => i.projectId === projectId );
}

// ----------------------------------------------------------------- health

export interface Health { tone: 'pink' | 'green' | 'neutral'; label: string; dot: 'pink' | 'green' }

export function projectHealth ( s: FlowState, project: FlowProject, issues: Issue[] ): Health {
  const mine = issuesForProject( issues, project.id ).filter( i => i.status !== 'fixed' );
  if ( mine.some( i => i.kind === 'gap' && i.status === 'needs_you' ) ) {
    return { tone: 'pink', dot: 'pink', label: project.shipsOn ? `At risk · ships ${fmtDay( project.shipsOn )}` : 'At risk' };
  }
  if ( mine.some( i => i.kind === 'stall' ) ) return { tone: 'pink', dot: 'pink', label: 'Stalling' };
  if ( mine.some( i => i.kind === 'order' ) ) return { tone: 'neutral', dot: 'pink', label: 'Order issue' };
  if ( mine.length ) return { tone: 'neutral', dot: 'pink', label: 'Needs a look' };
  return { tone: 'green', dot: 'green', label: 'Moving' };
}

// ------------------------------------------------------------------ track

export interface Range { start: Date; end: Date }

export function rangeFor ( key: RangeKey, now: Date ): Range {
  if ( key === '1w' ) return { start: addDays( now, -3 ), end: addDays( now, 4 ) };
  if ( key === 'q' ) return { start: addDays( now, -30 ), end: addDays( now, 60 ) };
  return { start: addDays( now, -8 ), end: addDays( now, 13 ) };
}

export function xOf ( date: string | Date, r: Range ): number {
  const span = r.end.getTime() - r.start.getTime();
  return ( startOfDay( date ).getTime() - r.start.getTime() ) / span;
}

export function nodeKindFor ( s: FlowState, m: FlowMove, issues: Issue[] ): NodeKind {
  if ( m.done ) return 'done';
  const mine = issues.filter( i => i.moveIds[0] === m.id && i.status !== 'fixed' );
  if ( mine.some( i => i.kind === 'gap' && i.id.startsWith( 'gap:owner' ) ) ) return 'gap';
  if ( mine.some( i => i.kind === 'order' ) ) return 'order';
  const today = todaysActionOn( s, m.id );
  if ( today && today.moveId === m.id && ['reassigned', 'split', 'assigned', 'sequenced'].includes( today.type ) ) return 'fixed';
  if ( mine.some( i => i.kind === 'stall' ) ) return 'stalled';
  if ( mine.some( i => i.kind === 'gap' ) ) return 'gap';
  return 'upcoming';
}

function nodeLabel ( s: FlowState, m: FlowMove, kind: NodeKind ): string | undefined {
  if ( kind === 'fixed' ) {
    const a = todaysActionOn( s, m.id );
    const owner = ownerOf( s, m );
    if ( a?.type === 'sequenced' ) return a.subject;
    return `${m.short || shortTitle( m.title )} → ${firstName( owner )}`;
  }
  return kind === 'upcoming' || kind === 'done' ? undefined : m.title;
}

function shortTitle ( title: string ): string {
  const words = title.replace( /^(Price|Send|Write|Finish) the /i, '' ).split( ' ' );
  return words.slice( 0, 2 ).join( ' ' ).replace( /^Acme /, '' ).replace( /^./, c => c.toUpperCase() );
}

/**
 * One project as a line against today. `labels: 'all'` is the phase-banded
 * project view (every move named, owner beneath); otherwise only problem
 * nodes get a label, as on Momentum.
 */
export function trackFor ( s: FlowState, moves: FlowMove[], issues: Issue[], r: Range, opts: { labels?: 'problems' | 'all'; ticks?: boolean } = {} ): TrackModel {
  const inRange = moves.filter( m => {
    const x = xOf( m.due, r );
    return x >= -0.001 && x <= 1.001;
  } );
  const nodes: TrackNode[] = inRange.map( m => {
    const kind = nodeKindFor( s, m, issues );
    const owner = ownerOf( s, m );
    const label = opts.labels === 'all' ? m.title : nodeLabel( s, m, kind );
    const sublabel = opts.labels === 'all'
      ? ( kind === 'gap' ? 'no owner' : `${firstName( owner )}${kind === 'stalled' && liveActions( s ).some( a => a.type === 'nudged' && a.moveId === m.id ) ? ' · nudged' : ''}` )
      : undefined;
    return {
      id: m.id, moveId: m.id, x: clamp( xOf( m.due, r ) ), kind, label, sublabel,
      text: kind === 'stalled' ? `${daysStill( s, m )}d` : undefined,
    };
  } );
  // Nodes sitting on the same spot read as one, so nudge them apart.
  nodes.sort( ( a, b ) => a.x - b.x );
  for ( let i = 1; i < nodes.length; i++ ) {
    if ( nodes[i].x - nodes[i - 1].x < 0.035 ) nodes[i].x = Math.min( 1, nodes[i - 1].x + 0.035 );
  }

  const todayX = xOf( s.now, r );
  const today = todayX >= 0 && todayX <= 1 ? todayX : null;
  const done = nodes.filter( n => n.kind === 'done' );
  const progress = done.length ? Math.max( ...done.map( n => n.x ) ) : 0;
  const stalledNode = nodes.find( n => n.kind === 'stalled' || ( n.kind === 'fixed' && moveById( s, n.id ) && daysStill( s, moveById( s, n.id )! ) >= 4 ) );
  const stallEnd = Math.max( today ?? 0, nodes.find( n => n.kind === 'gap' && stalledNode && n.x > stalledNode.x )?.x ?? 0 );
  const stall = stalledNode && today !== null ? { from: Math.min( stalledNode.x, stallEnd ), to: Math.max( stalledNode.x, stallEnd ) } : undefined;

  const ticks = opts.ticks ? tickLabels( r ) : undefined;
  return { nodes, today, progress, stall, ticks };
}

export function tickLabels ( r: Range ): { x: number; label: string }[] {
  const span = daysBetween( r.start, r.end );
  const step = span <= 8 ? 2 : span <= 21 ? 7 : 30;
  const out: { x: number; label: string }[] = [];
  for ( let d = 0; d <= span; d += step ) out.push( { x: d / span, label: fmtDay( addDays( r.start, d ) ) } );
  return out;
}

function clamp ( x: number ): number {
  return Math.max( 0, Math.min( 1, x ) );
}

/**
 * Track for the phase-banded project view: every move, evenly spaced in
 * date order so each one has room for its name and owner. Today sits
 * between its neighbours by date.
 */
export function phaseTrack ( s: FlowState, project: FlowProject, issues: Issue[] ): { model: TrackModel; phases: { label: string; x: number }[] } {
  const moves = projectMoves( s, project.id );
  if ( !moves.length ) return { model: { nodes: [], today: null, progress: 0 }, phases: [] };
  const n = moves.length;
  const slot = ( i: number ) => n === 1 ? 0.5 : 0.04 + ( i / ( n - 1 ) ) * 0.92;
  const r: Range = { start: addDays( moves[0].due, -1 ), end: addDays( moves[n - 1].due, 1 ) };
  const byDate = trackFor( s, moves, issues, r, { labels: 'all' } );
  const nodes = moves.map( ( m, i ) => ( { ...byDate.nodes.find( x => x.id === m.id )!, x: slot( i ) } ) );

  // Today between the last move due before it and the first one after.
  const now = s.now.getTime();
  const after = moves.findIndex( m => toDate( m.due ).getTime() > now );
  let today: number | null = null;
  if ( after === -1 ) today = null;
  else if ( after === 0 ) today = slot( 0 ) / 2;
  else {
    const a = toDate( moves[after - 1].due ).getTime();
    const b = toDate( moves[after].due ).getTime();
    today = slot( after - 1 ) + ( slot( after ) - slot( after - 1 ) ) * ( ( now - a ) / Math.max( 1, b - a ) );
  }
  const done = nodes.filter( x => x.kind === 'done' );
  const stalled = nodes.find( x => x.kind === 'stalled' );
  const gapAfter = stalled && nodes.find( x => x.kind === 'gap' && x.x > stalled.x );
  const stallEnd = Math.max( today ?? 0, gapAfter?.x ?? 0 );
  const model: TrackModel = {
    nodes, today,
    progress: done.length ? Math.max( ...done.map( x => x.x ) ) : 0,
    stall: stalled && today !== null ? { from: Math.min( stalled.x, stallEnd ), to: Math.max( stalled.x, stallEnd ) } : undefined,
  };
  const phases = ( project.phases || [] ).map( label => {
    const i = moves.findIndex( m => m.phase === label );
    return { label, x: i < 0 ? -1 : i === 0 ? 0 : ( slot( i - 1 ) + slot( i ) ) / 2 };
  } ).filter( p => p.x >= 0 );
  return { model, phases };
}

// ---------------------------------------------------------------- summary

export function forecast ( s: FlowState, project: FlowProject, issues: Issue[] ): { title: string; text: string } {
  const open = issuesForProject( issues, project.id ).filter( i => i.status === 'needs_you' );
  const ship = project.shipsOn || projectMoves( s, project.id ).slice( -1 )[0]?.due;
  if ( !ship ) return { title: 'No end date', text: 'Add a launch move to forecast.' };
  const gap = open.find( i => i.kind === 'gap' );
  if ( gap ) {
    const m = moveById( s, gap.moveIds[0] )!;
    return { title: `Slips to ${fmtDay( addDays( ship, 7 ) )}`, text: `Holds at ${fmtDay( ship )} if ${shortTitle( m.title )} has an owner by ${fmtWeekday( m.due )}.` };
  }
  if ( open.length ) return { title: `Holds at ${fmtDay( ship )}`, text: `${open.length} thing${open.length === 1 ? '' : 's'} could move it.` };
  return { title: `Holds at ${fmtDay( ship )}`, text: 'Every move has an owner and a next action.' };
}

/** The longest chain of open moves through dependsOn - the moves with no slack. */
export function criticalPath ( s: FlowState, projectId: string ): FlowMove[] {
  const open = projectMoves( s, projectId ).filter( isOpen );
  const memo = new Map<string, FlowMove[]>();
  const chainFrom = ( m: FlowMove ): FlowMove[] => {
    if ( memo.has( m.id ) ) return memo.get( m.id )!;
    memo.set( m.id, [m] );
    const nexts = open.filter( n => n.dependsOn.includes( m.id ) ).map( chainFrom );
    const best = nexts.sort( ( a, b ) => b.length - a.length )[0] || [];
    const chain = [m, ...best];
    memo.set( m.id, chain );
    return chain;
  };
  return open.map( chainFrom ).sort( ( a, b ) => b.length - a.length )[0] || [];
}

export function nextActionsSet ( s: FlowState, projectId: string ): { set: number; total: number; missing: FlowMove[] } {
  const open = projectMoves( s, projectId ).filter( isOpen );
  const missing = open.filter( m => !m.nextAction.trim() || ( m.lane === 'person' && !m.assigneeId ) );
  return { set: open.length - missing.length, total: open.length, missing };
}

// --------------------------------------------------------------- sequence

export interface SequenceProposal {
  issue: Issue;
  current: FlowMove[];
  proposed: { move: FlowMove; due: string; changed: boolean }[];
  changes: MoveChange[];
  whatChanges: string;
  whatStays: string;
  why: string;
  waitingOn?: string;
  notify: Person[];
}

export function sequenceProposal ( s: FlowState, issue: Issue ): SequenceProposal | null {
  if ( issue.kind !== 'order' ) return null;
  const a = moveById( s, issue.moveIds[0] );
  const b = moveById( s, issue.moveIds[1] );
  if ( !a || !b ) return null;
  const shift = daysBetween( a.due, b.due );
  const newDue: Record<string, string> = { [b.id]: isoDay( a.due ), [a.id]: isoDay( b.due ) };
  // Anything that waits on the move we pushed later keeps its gap behind it.
  for ( const d of downstream( s, a.id ) ) {
    if ( d.done || d.dateLockedBy ) continue;
    const prev = d.dependsOn.map( id => newDue[id] || moveById( s, id )?.due ).filter( Boolean ) as string[];
    const latest = prev.sort().pop();
    if ( latest && toDate( d.due ) <= toDate( latest ) ) newDue[d.id] = isoDay( addDays( d.due, shift ) );
  }
  const current = projectMoves( s, issue.projectId );
  const proposed = current
    .map( m => ( { move: m, due: newDue[m.id] || m.due, changed: !!newDue[m.id] && ( m.id === a.id || m.id === b.id ) } ) )
    .sort( ( x, y ) => toDate( x.due ).getTime() - toDate( y.due ).getTime() );
  const changes: MoveChange[] = Object.entries( newDue ).map( ( [moveId, due] ) => ( { moveId, before: { due: moveById( s, moveId )!.due }, after: { due } } ) );

  const shifted = Object.keys( newDue ).filter( id => id !== a.id && id !== b.id ).map( id => moveById( s, id )! );
  const lastLocked = current.filter( m => m.dateLockedBy && !newDue[m.id] ).slice( -1 )[0] || current.slice( -1 )[0];
  const notify = [ownerOf( s, b ), ownerOf( s, a )].filter( ( p, i, l ): p is Person => !!p && l.findIndex( q => q?.id === p.id ) === i );
  const locker = a.dateLockedBy === 'manual' ? personById( s, a.dateLockedById || a.assigneeId ) : b.dateLockedBy === 'manual' ? personById( s, b.dateLockedById || b.assigneeId ) : undefined;
  const locked = a.dateLockedBy || b.dateLockedBy;

  return {
    issue, current, proposed, changes, notify,
    whatChanges: `${shortTitle( b.title )} moves up to ${fmtWeekday( a.due )}. ${shortTitle( a.title )} moves to ${fmtWeekday( b.due )}.`
      + ( shifted.length ? ` ${shifted.map( m => shortTitle( m.title ) ).join( ', ' )} move${shifted.length === 1 ? 's' : ''} ${shift} days later.` : '' ),
    whatStays: `${lastLocked ? `${shortTitle( lastLocked.title )} on ${fmtDay( lastLocked.due )}. ` : ''}Nobody’s load goes over this week.`,
    why: a.orderNote || `${a.title} depends on ${b.title.toLowerCase()}.`,
    waitingOn: locked ? `Waiting on you: it moves a date ${locker ? firstName( locker ) + ' set' : 'the client set'}` : undefined,
  };
}

// ---------------------------------------------------------------- copy

/** "Give to Priya" for an assign choice, the plain label otherwise. */
export function choiceLabel ( c: IssueChoice ): string {
  return c.run.kind === 'assign' && !c.label.includes( ' ' ) ? `Give to ${c.label}` : c.label;
}

/** The one-line lead under a margin-note title ("4 moves wait on it."). */
export function issueBrief ( s: FlowState, i: Issue ): string {
  if ( i.kind === 'gap' && i.id.startsWith( 'gap:owner' ) ) {
    const n = downstream( s, i.moveIds[0] ).filter( isOpen ).length;
    return n ? `${n} move${n === 1 ? ' waits' : 's wait'} on it.` : '';
  }
  if ( i.kind === 'stall' ) return i.status === 'watching' ? 'Watching it.' : '';
  return '';
}

export type MarginNote =
  | { kind: 'needs'; issue: Issue }
  | { kind: 'did'; action: ToddAction }
  | { kind: 'watch'; text: string }
  | { kind: 'none' };

/** What TODD writes in the margin next to a project's line. */
export function marginNote ( s: FlowState, projectId: string, issues: Issue[] ): MarginNote {
  const mine = issuesForProject( issues, projectId );
  const needs = needsYou( mine )[0];
  if ( needs ) return { kind: 'needs', issue: needs };
  const did = liveActions( s )
    .filter( a => a.projectId === projectId && a.auto !== undefined && daysBetween( a.createdAt, s.now ) === 0 && a.type !== 'nudged' && a.changes.length )
    .sort( ( a, b ) => b.createdAt.localeCompare( a.createdAt ) )[0];
  if ( did ) return { kind: 'did', action: did };
  const watching = mine.find( i => i.status === 'watching' );
  if ( watching ) return { kind: 'watch', text: watching.title };
  return { kind: 'none' };
}

export function plural ( n: number, word: string ): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
