describe( 'Moves view switching and completion workflows', () => {
  const signedInUser = {
    uid: 'moves-views-user',
    tenantId: 'moves-views-tenant',
    email: 'moves-views@example.com',
    paid: true
  };

  // Same Firestore short-circuit moves-crud.cy.ts uses so the component's
  // data-loading step fails fast instead of hanging.
  const stubFirestore = () => {
    cy.intercept( { hostname: 'firestore.googleapis.com' }, { statusCode: 403, body: {} } );
  };

  it( 'creates a move, confirms its status/progress in the moves-view command panel, cycles through every view, and completes it from the hierarchy view', () => {
    // horizontal-task-timeline.component.ts's calendar view defaults its
    // 30-day window to start from today, and excludes anything outside
    // it ("N Move are outside this calendar range") - so the fixture's
    // due date has to stay relative to whenever the suite actually runs,
    // not a hardcoded date that will eventually fall into the past.
    const dueDate = new Date( Date.now() + 5 * 24 * 60 * 60 * 1000 ).toISOString();

    const createdMove = {
      id: 'move-views-1',
      // Kept under 25 chars deliberately - timeline.component.html
      // truncates titles at 25, horizontal-task-timeline at 34, so a
      // longer title would get cut off and break the exact-text
      // assertions below in some views but not others.
      title: 'Onboarding sequence',
      description: 'Draft the first three onboarding emails.',
      dueDate,
      progress: 0,
      status: 'not-started',
      priority: 'medium',
      isCompleted: false,
      needsAttention: false,
      contactIds: [],
      contacts: [],
      documents: [],
      images: [],
      subTasks: [],
      projectId: '',
      taskTypeId: '',
      ownerId: signedInUser.uid,
      tenantId: signedInUser.tenantId,
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z'
    };

    const completedMove = {
      ...createdMove,
      isCompleted: true,
      progress: 100,
      status: 'completed',
      updatedAt: '2026-04-21T00:00:00.000Z'
    };

    let storedMoves: typeof createdMove[] = [];

    stubFirestore();

    cy.intercept( 'POST', '**/moves', {
      statusCode: 200,
      body: { task: createdMove }
    } ).as( 'createMove' );

    cy.intercept( 'GET', '**/moves', ( req ) => {
      req.reply( { statusCode: 200, body: { tasks: storedMoves } } );
    } ).as( 'loadMoves' );

    cy.intercept( 'PUT', `**/moves/${createdMove.id}`, ( req ) => {
      expect( req.body.isCompleted ).to.equal( true );
      expect( req.body.progress ).to.equal( 100 );
      expect( req.body.status ).to.equal( 'completed' );
      req.reply( { statusCode: 200, body: { task: completedMove } } );
    } ).as( 'completeMove' );

    // --- Create the move ---
    cy.visitWithCypressAuth( '/move', signedInUser );
    cy.get( '#preloader', { timeout: 8000 } ).should( 'not.exist' );
    cy.get( '[data-cy="moves-edit-title"]' ).type( createdMove.title );
    cy.get( '[data-cy="moves-edit-description"]' ).type( createdMove.description );
    cy.get( '[data-cy="moves-edit-save-top"]' ).click();
    cy.wait( '@createMove' );
    storedMoves = [createdMove];

    // --- Check its status/progress via the moves-view command panel ---
    cy.visit( '/moves-view' );
    cy.wait( '@loadMoves' );

    // task-view-parent.component.ts defaults activeTab to 'overview'; the
    // first loaded move is auto-selected in the background, but the
    // Selected Move tab (and its command panel) still needs switching to.
    cy.get( '[data-cy="moves-tab-selected"]' ).click();
    cy.contains( createdMove.title ).should( 'exist' );
    cy.contains( '.selected-task-summary-card', 'Status' ).should( 'contain', 'not-started' );
    cy.contains( '.selected-task-summary-card', 'Progress' ).should( 'contain', '0%' );

    // --- Cycle through every view ---
    cy.get( '[data-cy="moves-tab-browser"]' ).click();

    cy.get( '[data-cy="moves-view-checklist"]' ).click();
    cy.get( `[data-cy="moves-checklist-item-${createdMove.id}"]` ).should( 'be.visible' );

    cy.get( '[data-cy="moves-view-timeline"]' ).click();
    cy.get( 'ul.timeline' ).should( 'be.visible' );
    cy.contains( '.timeline-title', createdMove.title ).should( 'exist' );

    cy.get( '[data-cy="moves-view-calendar"]' ).click();
    cy.get( '.timeline-container' ).should( 'be.visible' );
    cy.contains( '.task-name-copy', createdMove.title ).should( 'exist' );

    cy.get( '[data-cy="moves-view-hierarchy"]' ).click();
    cy.get( '.hierarchy-parent-card' ).should( 'be.visible' );
    cy.contains( '.hierarchy-parent-card', createdMove.title ).should( 'exist' );

    // --- Complete it from the hierarchy view (a different code path than
    //     the checklist toggle moves-crud.cy.ts already covers) ---
    cy.contains( '.hierarchy-parent-card', createdMove.title )
      .find( 'button' ).contains( 'Complete' ).click();

    cy.wait( '@completeMove' );
    cy.contains( '.hierarchy-parent-card', createdMove.title )
      .find( 'button' ).contains( 'Reopen' ).should( 'exist' );

    // --- Confirm the command panel reflects the completion ---
    cy.get( '[data-cy="moves-tab-selected"]' ).click();
    cy.contains( '.selected-task-summary-card', 'Status' ).should( 'contain', 'completed' );
    cy.contains( '.selected-task-summary-card', 'Progress' ).should( 'contain', '100%' );
  } );
} );
