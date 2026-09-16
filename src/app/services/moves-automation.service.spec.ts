import { MovesAutomationService } from './moves-automation.service';
import { Task } from '../models/task.model';

function makeTask ( overrides: Partial<Task> = {} ): Task {
  return {
    id: 'task-1',
    title: 'Sample move',
    dueDate: '',
    progress: 0,
    status: 'not-started',
    isCompleted: false,
    ...overrides,
  };
}

function daysFromNow ( days: number ): string {
  const date = new Date();
  date.setDate( date.getDate() + days );
  return date.toISOString();
}

describe( 'MovesAutomationService', () => {
  let service: MovesAutomationService;

  beforeEach( () => {
    service = new MovesAutomationService();
  } );

  describe( 'findScheduleAdjustmentCandidates', () => {
    it( 'flags a move with no due date', () => {
      const task = makeTask( { dueDate: '' } );
      expect( service.findScheduleAdjustmentCandidates( [task] ) ).toEqual( [task] );
    } );

    it( 'flags an overdue, incomplete move', () => {
      const task = makeTask( { dueDate: daysFromNow( -5 ), progress: 40 } );
      expect( service.findScheduleAdjustmentCandidates( [task] ) ).toEqual( [task] );
    } );

    it( 'does not flag an overdue move that is already fully progressed', () => {
      const task = makeTask( { dueDate: daysFromNow( -5 ), progress: 100 } );
      expect( service.findScheduleAdjustmentCandidates( [task] ) ).toEqual( [] );
    } );

    it( 'flags a move due soon with low progress', () => {
      const task = makeTask( { dueDate: daysFromNow( 1 ), progress: 20 } );
      expect( service.findScheduleAdjustmentCandidates( [task] ) ).toEqual( [task] );
    } );

    it( 'does not flag a healthy move with a normal due date and decent progress', () => {
      const task = makeTask( { dueDate: daysFromNow( 10 ), progress: 60 } );
      expect( service.findScheduleAdjustmentCandidates( [task] ) ).toEqual( [] );
    } );

    it( 'flags a move with pending extension days', () => {
      const task = makeTask( { dueDate: daysFromNow( 10 ), progress: 60, extensionDays: 3 } );
      expect( service.findScheduleAdjustmentCandidates( [task] ) ).toEqual( [task] );
    } );
  } );

  describe( 'buildScheduleAdjustmentPatches', () => {
    it( 'assigns a near-term due date to a move with none', () => {
      const task = makeTask( { id: 'no-date', dueDate: '' } );
      const [patch] = service.buildScheduleAdjustmentPatches( [task] );

      expect( patch.taskId ).toBe( 'no-date' );
      expect( patch.changes.dueDate ).toBeTruthy();
      expect( patch.changes.needsAttention ).toBe( false );
      expect( patch.reason ).toContain( 'added a due date' );
    } );

    it( 'pushes an overdue move\'s due date forward', () => {
      const task = makeTask( { id: 'overdue', dueDate: daysFromNow( -5 ), progress: 10 } );
      const [patch] = service.buildScheduleAdjustmentPatches( [task] );

      expect( patch.taskId ).toBe( 'overdue' );
      expect( new Date( patch.changes.dueDate as string ).getTime() ).toBeGreaterThan( Date.now() );
      expect( patch.reason ).toContain( 'overdue' );
    } );

    it( 'resets extensionDays to 0 after applying the requested extension', () => {
      const task = makeTask( { id: 'ext', dueDate: daysFromNow( 10 ), progress: 60, extensionDays: 5 } );
      const [patch] = service.buildScheduleAdjustmentPatches( [task] );

      expect( patch.changes.extensionDays ).toBe( 0 );
      expect( patch.reason ).toContain( 'extension days' );
    } );

    it( 'skips tasks with no id', () => {
      const task = makeTask( { id: undefined, dueDate: '' } );
      expect( service.buildScheduleAdjustmentPatches( [task] ) ).toEqual( [] );
    } );
  } );

  describe( 'findStatusAdjustmentCandidates / buildStatusAdjustmentPatches', () => {
    it( 'marks a fully-progressed move completed', () => {
      const task = makeTask( { id: 'done', progress: 100, status: 'in-progress', isCompleted: false } );
      const [patch] = service.buildStatusAdjustmentPatches( [task] );

      expect( patch.changes.status ).toBe( 'completed' );
      expect( patch.changes.isCompleted ).toBe( true );
    } );

    it( 'moves a started-but-untouched-status move to in-progress', () => {
      const task = makeTask( { id: 'started', progress: 25, status: 'not-started' } );
      const [patch] = service.buildStatusAdjustmentPatches( [task] );

      expect( patch.changes.status ).toBe( 'in-progress' );
    } );

    it( 'puts an overdue, unresolved move on hold', () => {
      const task = makeTask( { id: 'stuck', progress: 10, status: 'in-progress', dueDate: daysFromNow( -3 ) } );
      const [patch] = service.buildStatusAdjustmentPatches( [task] );

      expect( patch.changes.status ).toBe( 'on-hold' );
    } );

    it( 'reopens a move marked completed without the completion signal', () => {
      const task = makeTask( { id: 'reopen', progress: 40, status: 'completed', isCompleted: false } );
      const [patch] = service.buildStatusAdjustmentPatches( [task] );

      expect( patch.changes.status ).toBe( 'in-progress' );
    } );

    it( 'does not flag a move whose status already matches its progress', () => {
      const task = makeTask( { id: 'fine', progress: 40, status: 'in-progress', dueDate: daysFromNow( 10 ) } );
      expect( service.findStatusAdjustmentCandidates( [task] ) ).toEqual( [] );
    } );
  } );

  describe( 'buildAutomationLanes', () => {
    it( 'reports zero counts and a good tone when nothing needs attention', () => {
      const task = makeTask( {
        id: 'healthy',
        dueDate: daysFromNow( 10 ),
        progress: 50,
        status: 'in-progress',
        description: 'Has context already.',
        projectId: 'project-1',
        contactIds: ['contact-1'],
        documents: [{ id: 'doc-1' } as any],
      } );

      const lanes = service.buildAutomationLanes( [task] );
      const schedule = lanes.find( lane => lane.key === 'schedule' )!;
      const status = lanes.find( lane => lane.key === 'status' )!;
      const resources = lanes.find( lane => lane.key === 'resources' )!;

      expect( schedule.count ).toBe( 0 );
      expect( schedule.tone ).toBe( 'good' );
      expect( status.count ).toBe( 0 );
      expect( resources.count ).toBe( 0 );
    } );

    it( 'counts a move needing a schedule fix and sets a warn tone', () => {
      const task = makeTask( { id: 'no-date', dueDate: '' } );
      const lanes = service.buildAutomationLanes( [task] );
      const schedule = lanes.find( lane => lane.key === 'schedule' )!;

      expect( schedule.count ).toBe( 1 );
      expect( schedule.tone ).toBe( 'warn' );
      expect( schedule.nextAction ).toContain( 'Sample move' );
    } );

    it( 'always returns exactly the four expected lanes', () => {
      const lanes = service.buildAutomationLanes( [] );
      expect( lanes.map( lane => lane.key ) ).toEqual( ['schedule', 'status', 'resources', 'suggestions'] );
    } );
  } );

  describe( 'getResourceRecommendation', () => {
    it( 'lists every missing resource for a bare move', () => {
      const task = makeTask( { title: 'Bare move' } );
      const recommendation = service.getResourceRecommendation( task );

      expect( recommendation.missing ).toEqual( ['contact', 'project', 'documents', 'description'] );
      expect( recommendation.summary ).toContain( 'Bare move' );
    } );

    it( 'reports no gaps for a fully-resourced move', () => {
      const task = makeTask( {
        title: 'Fully staffed move',
        contactIds: ['contact-1'],
        projectId: 'project-1',
        documents: [{ id: 'doc-1' } as any],
        description: 'Clear next step.',
      } );

      const recommendation = service.getResourceRecommendation( task );
      expect( recommendation.missing ).toEqual( [] );
      expect( recommendation.summary ).toContain( 'already has the core context' );
    } );
  } );

  describe( 'buildSuggestedMoveDrafts', () => {
    it( 'suggests a follow-up for a completed move with a contact', () => {
      const completed = makeTask( {
        id: 'closed-1',
        title: 'Closed partner intro',
        isCompleted: true,
        progress: 100,
        status: 'completed',
        contactIds: ['contact-1'],
      } );

      const drafts = service.buildSuggestedMoveDrafts( [completed] );
      expect( drafts.length ).toBe( 1 );
      expect( drafts[0].task.title ).toBe( 'Follow up after Closed partner intro' );
    } );

    it( 'suggests a next step for an active move with progress but no due date', () => {
      const active = makeTask( {
        id: 'active-1',
        title: 'In-flight redesign',
        isCompleted: false,
        progress: 30,
        status: 'in-progress',
        dueDate: '',
      } );

      const drafts = service.buildSuggestedMoveDrafts( [active] );
      expect( drafts.length ).toBe( 1 );
      expect( drafts[0].task.title ).toBe( 'Set next step for In-flight redesign' );
    } );

    it( 'does not suggest a duplicate when the follow-up title already exists', () => {
      const completed = makeTask( {
        id: 'closed-1',
        title: 'Closed partner intro',
        isCompleted: true,
        progress: 100,
        status: 'completed',
        contactIds: ['contact-1'],
      } );
      const alreadyExists = makeTask( {
        id: 'existing-followup',
        title: 'Follow up after Closed partner intro',
      } );

      const drafts = service.buildSuggestedMoveDrafts( [completed, alreadyExists] );
      expect( drafts.length ).toBe( 0 );
    } );

    it( 'suggests nothing for a move that is neither completed-with-contacts nor active-without-a-date', () => {
      const task = makeTask( { id: 'plain', title: 'Plain move', dueDate: daysFromNow( 5 ), progress: 20 } );
      expect( service.buildSuggestedMoveDrafts( [task] ) ).toEqual( [] );
    } );
  } );
} );
