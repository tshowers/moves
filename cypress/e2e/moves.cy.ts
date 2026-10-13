/**
 * Flow map (design_handoff_moves_flow_map). Signed out, /app shows the
 * sample team; signed in, it maps the tenant's own moves. Fixes made on
 * one screen show on every screen and can be undone.
 */
describe( 'Moves flow map - sample team', () => {
  it( 'draws every project as a line with TODD’s notes', () => {
    cy.visit( '/app' );
    cy.get( '[data-cy="momentum"]' ).should( 'be.visible' );
    cy.get( '[data-cy="momentum-name"]' ).should( 'have.length', 5 );
    cy.contains( 'Two lines broke overnight.' ).should( 'be.visible' );
    cy.get( '[data-cy="track-harbor"] [data-kind="gap"]' ).should( 'have.length', 1 );
    cy.get( '[data-cy="track-harbor"] [data-kind="stalled"]' ).should( 'contain.text', '6d' );
  } );

  it( 'assigns a gap from the margin note, then undoes it', () => {
    cy.visit( '/app' );
    cy.get( '[data-cy="note-primary"]' ).contains( 'Give to Priya' ).click();
    cy.get( '[data-cy="flow-toast"]' ).should( 'contain.text', 'QA sign-off is now Priya’s.' );
    cy.get( '[data-cy="track-harbor"] [data-kind="gap"]' ).should( 'not.exist' );
    cy.get( '[data-cy="track-harbor"] [data-kind="fixed"]' ).should( 'exist' );

    cy.get( '[data-cy="toast-undo"]' ).click();
    cy.get( '[data-cy="track-harbor"] [data-kind="gap"]' ).should( 'have.length', 1 );
  } );

  it( 'applies the proposed order and shows it fixed on Momentum', () => {
    cy.visit( '/app/projects/brand/sequence' );
    cy.contains( 'Proposed order' ).should( 'be.visible' );
    cy.get( '[data-cy="sequence-apply"]' ).click();
    cy.location( 'pathname' ).should( 'eq', '/app' );
    cy.get( '[data-cy="flow-toast"]' ).should( 'contain.text', 'Order swapped.' );
    cy.get( '[data-cy="track-brand"] [data-kind="order"]' ).should( 'not.exist' );
    cy.get( '[data-cy="track-brand"] [data-kind="fixed"]' ).should( 'exist' );
  } );

  it( 'runs the weekly review from the keyboard', () => {
    cy.visit( '/app/review' );
    cy.get( '[data-cy="review"]' ).should( 'contain.text', 'QA sign-off has no owner' );
    cy.get( '[data-cy="review-choice"]' ).should( 'have.length', 4 );
    cy.get( 'body' ).type( '1' );
    cy.get( '[data-cy="review-confirm"]' ).should( 'contain.text', 'Priya' );
  } );

  it( 'opens a move in the drawer and undoes what TODD did', () => {
    cy.visit( '/app/projects/acme?move=a2' );
    cy.get( '[data-cy="move-drawer"]' ).should( 'contain.text', 'Price the Acme add-ons' ).and( 'contain.text', 'Who can do this' );
    cy.get( '[data-cy="timeline-undo"]' ).last().click();
    cy.get( '[data-cy="flow-toast"]' ).should( 'contain.text', 'Undone.' );
    cy.get( 'body' ).type( '{esc}' );
    cy.get( '[data-cy="move-drawer"]' ).should( 'not.exist' );
  } );

  it( 'turns a pasted plan into a line with checks', () => {
    cy.visit( '/app/new' );
    cy.get( '[data-cy="new-project"]' ).should( 'contain.text', 'Fall campaign, as a line' );
    cy.contains( 'Press release comes before messaging is approved.' ).should( 'be.visible' );
    cy.contains( 'button', 'Give to Maya' ).click();
    cy.contains( 'have no owner' ).should( 'not.exist' );
  } );

  it( 'sends the old task-list links into the flow map', () => {
    cy.visit( '/moves-view' );
    cy.location( 'pathname' ).should( 'eq', '/app' );
    cy.visit( '/move/a2' );
    cy.location( 'pathname' ).should( 'eq', '/app' );
    cy.location( 'search' ).should( 'contain', 'move=a2' );
    cy.get( '[data-cy="move-drawer"]' ).should( 'be.visible' );
  } );
} );

describe( 'Moves flow map - signed in', () => {
  const signedInUser = { uid: 'flow-user', tenantId: 'flow-tenant', email: 'flow@example.com' };
  const task = ( id: string, title: string, extra: Record<string, unknown> = {} ) => ( {
    id, title, description: `${title} next step`, nextAction: `${title} next step`, dueDate: new Date( Date.now() + 2 * 86_400_000 ).toISOString(), progress: 0,
    status: 'not-started', isCompleted: false, ownerId: signedInUser.uid, assigneeId: signedInUser.uid, tenantId: signedInUser.tenantId,
    executionLane: 'person', dependsOn: [], updatedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), ...extra,
  } );
  const flowState = ( extra: Record<string, unknown> = {} ) => ( {
    success: true, actions: [], dismissed: {}, capacity: {}, projects: [], imported: false,
    rules: ['handoff', 'nudge', 'reschedule', 'split'].map( id => ( { id, enabled: true, locked: false } ) ).concat( ['lock-dates', 'no-outside'].map( id => ( { id, enabled: true, locked: true } ) ) ),
    ...extra,
  } );

  const stub = ( canWrite: boolean ) => {
    cy.intercept( { hostname: 'firestore.googleapis.com' }, { statusCode: 403, body: {} } );
    cy.intercept( 'GET', '**/account/summary*', { statusCode: 200, body: { success: true, data: { tenant: {}, writeAccess: { moves: canWrite } } } } );
    cy.intercept( 'GET', '**/moves', { statusCode: 200, body: { tasks: [task( 'live-1', 'Send contract to legal' ), task( 'live-2', 'Follow up with procurement' )] } } ).as( 'loadMoves' );
    cy.intercept( 'GET', '**/moves/flow', { statusCode: 200, body: flowState() } ).as( 'flowState' );
  };

  it( 'maps the tenant’s own moves and TODD’s state from the server', () => {
    stub( true );
    cy.visitWithCypressAuth( '/app', signedInUser );
    cy.wait( ['@flowState', '@loadMoves'] );
    cy.get( '[data-cy="momentum"]' ).should( 'contain.text', 'Not in a project' );
    cy.contains( 'Sample team' ).should( 'not.exist' );
  } );

  it( 'asks before a change when the account can only browse', () => {
    stub( false );
    cy.visitWithCypressAuth( '/app?move=live-1', signedInUser );
    cy.wait( '@loadMoves' );
    cy.get( '[data-cy="drawer-done"]' ).click();
    cy.get( '[data-cy="write-access-prompt"]' ).should( 'be.visible' );
  } );

  it( 'logs a decision on the server, then undoes it there', () => {
    stub( true );
    const saved = { id: 'srv-1', type: 'completed', moveId: 'live-1', projectId: '', subject: 'Send contract to legal', text: 'marked done.', reason: '', auto: false, createdAt: new Date().toISOString(), changes: [{ moveId: 'live-1', before: { done: false }, after: { done: true } }] };
    cy.intercept( 'POST', '**/moves/flow/actions', { statusCode: 200, body: { success: true, action: saved, tasks: [task( 'live-1', 'Send contract to legal', { isCompleted: true, status: 'completed' } )] } } ).as( 'record' );
    cy.intercept( 'POST', '**/moves/flow/actions/srv-1/undo', { statusCode: 200, body: { success: true, action: { ...saved, undoneAt: new Date().toISOString() }, tasks: [task( 'live-1', 'Send contract to legal' )] } } ).as( 'undo' );
    cy.visitWithCypressAuth( '/app?move=live-1', signedInUser );
    cy.wait( '@loadMoves' );
    cy.get( '[data-cy="drawer-done"]' ).click();
    cy.wait( '@record' ).its( 'request.body' ).should( 'deep.include', { type: 'completed', changes: [{ moveId: 'live-1', after: { done: true } }] } );
    cy.get( '[data-cy="flow-toast"]' ).should( 'contain.text', 'Marked done.' );
    cy.get( '[data-cy="toast-undo"]' ).click();
    cy.wait( '@undo' );
    cy.get( '[data-cy="flow-toast"]' ).should( 'contain.text', 'Undone.' );
  } );

  it( 'shows the server’s reason when Undo would overwrite a newer change', () => {
    stub( true );
    cy.intercept( 'GET', '**/moves/flow', { statusCode: 200, body: flowState( { actions: [{ id: 'srv-9', type: 'assigned', moveId: 'live-1', projectId: '', subject: 'Send contract to legal', text: 'to you.', reason: '', auto: false, createdAt: new Date().toISOString(), changes: [{ moveId: 'live-1', before: { assigneeId: null }, after: { assigneeId: 'flow-user' } }] }] } ) } );
    cy.intercept( 'POST', '**/moves/flow/actions/srv-9/undo', { statusCode: 409, body: { success: false, code: 'UNDO_CONFLICT', message: 'Send contract to legal changed since, so TODD won’t undo over it. Open it and fix it by hand.' } } ).as( 'undo' );
    cy.visitWithCypressAuth( '/app?move=live-1', signedInUser );
    cy.wait( '@loadMoves' );
    cy.get( '[data-cy="timeline-undo"]' ).click();
    cy.wait( '@undo' );
    cy.get( '[data-cy="flow-toast"]' ).should( 'contain.text', 'changed since' );
  } );

  it( 'saves rule switches on the server', () => {
    stub( true );
    cy.intercept( 'PUT', '**/moves/flow/rules/nudge', { statusCode: 200, body: { success: true, rules: [] } } ).as( 'rule' );
    cy.visitWithCypressAuth( '/app/todd', signedInUser );
    cy.wait( '@loadMoves' );
    cy.get( '[role="switch"][aria-label="Nudge the owner"]' ).click();
    cy.wait( '@rule' ).its( 'request.body' ).should( 'deep.equal', { enabled: false } );
  } );

  it( 'shows TODD’s practice week and lets the lead turn it on', () => {
    stub( true );
    const practice = { id: 'dry-handoff-live-2-2026-10-13', type: 'reassigned', moveId: 'live-2', projectId: '', subject: 'Follow up with procurement', text: 'from Maya to Priya. It sat 3 days with Maya.', reason: '', ruleId: 'handoff', auto: true, dryRun: true, createdAt: new Date().toISOString(), changes: [{ moveId: 'live-2', before: { assigneeId: null, lane: 'maya' }, after: { assigneeId: 'priya', lane: 'person' } }] };
    cy.intercept( 'GET', '**/moves/flow', { statusCode: 200, body: flowState( { actions: [practice], autonomy: { mode: 'dry_run', practiceEndsAt: new Date( Date.now() + 5 * 86_400_000 ).toISOString() } } ) } );
    cy.intercept( 'PUT', '**/moves/flow/autonomy', { statusCode: 200, body: { success: true, autonomy: { mode: 'on', chosenBy: 'flow-user' } } } ).as( 'autonomy' );
    cy.visitWithCypressAuth( '/app/todd', signedInUser );
    cy.wait( '@loadMoves' );
    cy.get( '[data-cy="todd-mode"]' ).should( 'contain.text', 'Practising until' );
    cy.contains( '.lr', 'Follow up with procurement' ).should( 'contain.text', 'Would have' ).and( 'contain.text', 'Practice' ).find( 'button' ).should( 'not.exist' );
    cy.contains( 'button', 'Turn on now' ).click();
    cy.wait( '@autonomy' ).its( 'request.body' ).should( 'deep.equal', { mode: 'on' } );
    cy.get( '[data-cy="todd-mode"]' ).should( 'contain.text', 'On.' );
  } );

  it( 'uploads what this browser kept before the server stored it, once', () => {
    stub( true );
    cy.intercept( 'POST', '**/moves/flow/import', { statusCode: 200, body: { success: true, movesUpdated: 1, actionsImported: 0 } } ).as( 'import' );
    cy.visitWithCypressAuth( '/app', signedInUser, {
      onBeforeLoad: ( win ) => win.localStorage.setItem( 'moves-flow:flow-tenant', JSON.stringify( { actions: [], overlay: { 'live-1': { nextAction: 'Call legal' } } } ) ),
    } );
    cy.wait( '@import' ).its( 'request.body.overlay' ).should( 'deep.equal', { 'live-1': { nextAction: 'Call legal' } } );
    cy.window().its( 'localStorage' ).invoke( 'getItem', 'moves-flow:flow-tenant' ).should( 'be.null' );
  } );
} );
