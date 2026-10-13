import fixture from './testing/flow-team.fixture.json';
import { byRoom, computeIssues, defaultRules, FlowState, MAYA_ID, TODD_ID } from './flow-engine';
import { FlowMove, Lane, Person } from './flow.models';

/**
 * The engine against the team in testing/flow-team.fixture.json - the same
 * file todd-backend's TODD rules are tested with (__tests__/fixtures/flow-team.json),
 * so what the app flags and what TODD acts on agree.
 */
describe( 'flow engine on the shared team', () => {
  type Row = ( typeof fixture.moves )[number] & { dependsOn?: string[]; dateLockedBy?: string; laneEnteredAt?: string; laneNotes?: Record<string, string> };

  function state (): FlowState {
    const people: Person[] = [
      { id: MAYA_ID, name: 'Maya', initials: 'MA', role: 'Assistant', kind: 'maya', capacity: 6 },
      { id: TODD_ID, name: 'TODD', initials: 'TO', role: 'Assistant', kind: 'todd', capacity: 10 },
      ...fixture.members.map( m => ( {
        id: m.id, name: m.displayName, initials: m.displayName.slice( 0, 2 ), role: '', kind: 'person' as const,
        capacity: ( fixture.capacity as Record<string, number> )[m.id] ?? 6,
      } ) ),
    ];
    const moves: FlowMove[] = ( fixture.moves as Row[] ).map( r => {
      const lane = ( r.executionLane || 'person' ) as Lane;
      return {
        id: r.id, projectId: r.projectId, title: r.title, nextAction: r.nextAction, lane,
        assigneeId: lane === 'person' ? r.assigneeId || null : null,
        due: r.dueDate.slice( 0, 10 ), done: !!( r as { isCompleted?: boolean } ).isCompleted,
        dependsOn: r.dependsOn || [], lastActivityAt: r.lastActivityAt,
        dateLockedBy: ( r.dateLockedBy || undefined ) as FlowMove['dateLockedBy'],
        laneEnteredAt: r.laneEnteredAt, laneNotes: r.laneNotes, history: [],
      };
    } );
    return {
      people, moves, actions: [], rules: defaultRules(), dismissed: {}, now: new Date( fixture.now ), pmId: fixture.leadId,
      projects: fixture.projects.map( p => ( { id: p.id, name: p.name, shipsOn: p.shipsOn, memberIds: p.memberIds, leadId: p.leadId } ) ),
    };
  }

  it( 'agrees on who has the most room', () => {
    for ( const [projectId, personId] of Object.entries( fixture.expect.mostRoom ) ) {
      expect( byRoom( state(), projectId )[0].id ).toBe( personId );
    }
  } );

  it( 'flags the same stalls, lane hold-ups and order breaks TODD acts on', () => {
    const issues = computeIssues( state() );
    const ids = ( prefix: string ) => issues.filter( i => i.id.startsWith( prefix ) ).map( i => i.moveIds[0] ).sort();
    expect( ids( 'stall:lane:' ) ).toEqual( [...fixture.expect.laneStalls].sort() );
    expect( issues.filter( i => i.kind === 'stall' && !i.id.startsWith( 'stall:lane:' ) ).map( i => i.moveIds[0] ).sort() ).toEqual( [...fixture.expect.stalls].sort() );
    expect( ids( 'order:' ) ).toEqual( [...fixture.expect.orderBreaks].sort() );
  } );

  it( 'stops calling a lane move stuck once it waits on another open move', () => {
    const s = state();
    const pricing = s.moves.find( m => m.id === 'pricing' )!;
    pricing.dependsOn = ['build'];
    expect( computeIssues( s ).some( i => i.id === 'stall:lane:pricing' ) ).toBeFalse();
  } );
} );
