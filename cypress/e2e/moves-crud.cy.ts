describe( 'Moves CRUD workflows', () => {
  const signedInUser = {
    uid: 'moves-crud-user',
    tenantId: 'moves-crud-tenant',
    email: 'moves-crud@example.com',
    paid: true
  };

  // Intercept Firebase Firestore calls so the component's data-loading step
  // fails fast instead of hanging, allowing setupPage() to call loadTaskFromRoute().
  const stubFirestore = () => {
    cy.intercept( { hostname: 'firestore.googleapis.com' }, { statusCode: 403, body: {} } );
  };

  it( 'lets a signed-in user create and update a move', () => {
    const createdMove = {
      id: 'move-crud-1',
      title: 'Follow up with Acme',
      description: 'Confirm the next meeting with the buyer.',
      dueDate: '2026-04-05T18:00:00.000Z',
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
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z'
    };

    const updatedMove = {
      ...createdMove,
      title: 'Follow up with Acme again',
      description: 'Confirm the rescheduled meeting and send the notes.',
      status: 'in-progress',
      updatedAt: '2026-04-02T00:05:00.000Z'
    };

    let storedMoves = [createdMove];

    stubFirestore();

    cy.intercept( 'POST', '**/moves', {
      statusCode: 200,
      body: { task: createdMove }
    } ).as( 'createMove' );

    cy.intercept( 'PUT', `**/moves/${createdMove.id}`, {
      statusCode: 200,
      body: { task: updatedMove }
    } ).as( 'updateMove' );

    cy.intercept( 'GET', '**/moves', ( req ) => {
      req.reply( {
        statusCode: 200,
        body: { tasks: storedMoves }
      } );
    } ).as( 'loadMoves' );

    cy.visitWithCypressAuth( '/move', signedInUser );
    cy.get( '#preloader', { timeout: 8000 } ).should( 'not.exist' );
    cy.get( '[data-cy="moves-edit-shell"]' ).should( 'be.visible' );

    cy.get( '[data-cy="moves-edit-title"]' ).type( createdMove.title );
    cy.get( '[data-cy="moves-edit-description"]' ).type( createdMove.description );
    cy.get( '[data-cy="moves-edit-save-top"]' ).click();

    cy.wait( '@createMove' );
    cy.wait( '@loadMoves' );
    cy.contains( '.toast-header', 'Move Saved' ).should( 'exist' );
    cy.get( '[data-cy="moves-edit-delete"]' ).should( 'be.visible' );

    storedMoves = [updatedMove];

    cy.get( '[data-cy="moves-edit-title"]' ).clear().type( updatedMove.title );
    cy.get( '[data-cy="moves-edit-description"]' ).clear().type( updatedMove.description );
    cy.get( '[data-cy="moves-edit-status"]' ).select( 'in-progress' );
    cy.get( '[data-cy="moves-edit-save-top"]' ).click();

    cy.wait( '@updateMove' );
    cy.wait( '@loadMoves' );
    cy.contains( '.toast-header', 'Move Updated' ).should( 'exist' );
    cy.get( '[data-cy="moves-edit-title"]' ).should( 'have.value', updatedMove.title );
    cy.get( '[data-cy="moves-edit-status"]' ).should( 'have.value', 'in-progress' );
  } );

  it( 'disables save button and shows title hint when title is empty', () => {
    stubFirestore();

    cy.intercept( 'GET', '**/moves', {
      statusCode: 200,
      body: { tasks: [] }
    } ).as( 'loadMoves' );

    cy.visitWithCypressAuth( '/move', signedInUser );
    cy.get( '#preloader', { timeout: 8000 } ).should( 'not.exist' );
    cy.get( '[data-cy="moves-edit-shell"]' ).should( 'be.visible' );

    cy.get( '[data-cy="moves-edit-save-top"]' ).should( 'be.disabled' );
    cy.contains( 'A move title is required before you can save.' ).should( 'be.visible' );

    cy.get( '[data-cy="moves-edit-title"]' ).type( 'Some title' );
    cy.get( '[data-cy="moves-edit-save-top"]' ).should( 'not.be.disabled' );
    cy.contains( 'A move title is required before you can save.' ).should( 'not.exist' );
  } );

  it( 'shows Save Failed notification when create returns 500', () => {
    stubFirestore();

    cy.intercept( 'POST', '**/moves', {
      statusCode: 500,
      body: { error: 'Internal server error' }
    } ).as( 'createMoveFail' );
    cy.intercept( 'GET', '**/moves', {
      statusCode: 200,
      body: { tasks: [] }
    } ).as( 'loadMoves' );

    cy.visitWithCypressAuth( '/move', signedInUser );
    cy.get( '#preloader', { timeout: 8000 } ).should( 'not.exist' );
    cy.get( '[data-cy="moves-edit-shell"]' ).should( 'be.visible' );
    cy.get( '[data-cy="moves-edit-title"]' ).type( 'Failing move' );
    cy.get( '[data-cy="moves-edit-save-top"]' ).click();

    cy.wait( '@createMoveFail' );
    cy.contains( '.toast-header', 'Save Failed' ).should( 'exist' );
    cy.get( '.toast.toast--error' ).should( 'be.visible' );
    cy.location( 'pathname' ).should( 'match', /^\/move/ );
  } );

  it( 'shows Save Failed notification when update returns 400', () => {
    const existingMove = {
      id: 'move-update-fail-1',
      title: 'Move to update',
      description: 'Will fail on update.',
      dueDate: '',
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
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z'
    };

    stubFirestore();

    cy.intercept( 'GET', `**/moves/${existingMove.id}`, {
      statusCode: 200,
      body: { task: existingMove }
    } ).as( 'getMove' );
    cy.intercept( 'GET', '**/moves', {
      statusCode: 200,
      body: { tasks: [existingMove] }
    } ).as( 'loadMoves' );
    cy.intercept( 'PUT', `**/moves/${existingMove.id}`, {
      statusCode: 400,
      body: { error: 'Validation failed' }
    } ).as( 'updateMoveFail' );

    cy.visitWithCypressAuth( `/move/${existingMove.id}`, signedInUser );
    cy.get( '#preloader', { timeout: 8000 } ).should( 'not.exist' );
    cy.wait( '@getMove' );
    cy.wait( '@loadMoves' );
    cy.get( '[data-cy="moves-edit-title"]' ).clear().type( 'Updated title' );
    cy.get( '[data-cy="moves-edit-save-top"]' ).click();

    cy.wait( '@updateMoveFail' );
    cy.contains( '.toast-header', 'Save Failed' ).should( 'exist' );
    cy.get( '.toast.toast--error' ).should( 'be.visible' );
    cy.contains( '.toast-header', 'Move Updated' ).should( 'not.exist' );
  } );

  it( 'lets a signed-in user delete a move from the edit screen', () => {
    const existingMove = {
      id: 'move-delete-1',
      title: 'Archive stale follow-up',
      description: 'This move is no longer needed.',
      dueDate: '2026-04-04T18:00:00.000Z',
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
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z'
    };

    stubFirestore();

    cy.intercept( 'GET', `**/moves/${existingMove.id}`, {
      statusCode: 200,
      body: { task: existingMove }
    } ).as( 'getMove' );

    cy.intercept( 'GET', '**/moves', {
      statusCode: 200,
      body: { tasks: [existingMove] }
    } ).as( 'loadMoves' );

    cy.intercept( 'DELETE', `**/moves/${existingMove.id}`, {
      statusCode: 200,
      body: { success: true }
    } ).as( 'deleteMove' );

    cy.visitWithCypressAuth( `/move/${existingMove.id}`, signedInUser );
    cy.get( '#preloader', { timeout: 8000 } ).should( 'not.exist' );
    cy.wait( '@getMove' );
    cy.wait( '@loadMoves' );

    cy.get( '[data-cy="moves-edit-delete"]' ).click();
    cy.wait( '@deleteMove' );
    // task-edit.component.ts's onDelete() navigates to /moves, not /app -
    // both render the same TaskHomeComponent (moves-home-shell).
    cy.location( 'pathname' ).should( 'eq', '/moves' );
    cy.get( '[data-cy="moves-home-shell"]' ).should( 'be.visible' );
  } );

  it( 'marks a move as completed from the checklist view and moves it to the completed section', () => {
    const activeMove = {
      id: 'move-checklist-complete-1',
      title: 'EPIC: Multi-user per tenant — Data model',
      description: 'Track the data model work.',
      dueDate: '2025-08-16T00:00:00.000Z',
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
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z'
    };

    const completedMove = {
      ...activeMove,
      isCompleted: true,
      progress: 100,
      status: 'completed',
      updatedAt: '2026-05-31T00:00:00.000Z'
    };

    stubFirestore();

    cy.intercept( 'GET', '**/moves', {
      statusCode: 200,
      body: { tasks: [activeMove] }
    } ).as( 'loadMoves' );

    cy.intercept( 'PUT', `**/moves/${activeMove.id}`, ( req ) => {
      expect( req.body.isCompleted ).to.equal( true );
      expect( req.body.progress ).to.equal( 100 );
      expect( req.body.status ).to.equal( 'completed' );
      req.reply( { statusCode: 200, body: { task: completedMove } } );
    } ).as( 'completeMove' );

    cy.visitWithCypressAuth( '/moves-view', signedInUser );
    cy.wait( '@loadMoves' );
    // The view switcher (checklist/timeline/calendar/hierarchy) lives
    // inside the Move Browser tab, not the default Overview tab.
    cy.get( '[data-cy="moves-tab-browser"]' ).click();
    cy.get( '[data-cy="moves-view-checklist"]' ).click();

    cy.get( `[data-cy="moves-checklist-item-${activeMove.id}"]` ).should( 'be.visible' );
    cy.get( `[data-cy="moves-checklist-toggle-${activeMove.id}"]` ).click();

    cy.wait( '@completeMove' );

    cy.get( '[data-cy="moves-checklist-completed-list"]' ).should( 'be.visible' );
    cy.get( `[data-cy="moves-checklist-completed-item-${activeMove.id}"]` ).should( 'be.visible' );
    cy.get( `[data-cy="moves-checklist-item-${activeMove.id}"]` ).should( 'not.exist' );
  } );

  it( 'sends isCompleted false when unchecking a completed move from the checklist view', () => {
    const completedMove = {
      id: 'move-checklist-uncomplete-1',
      title: 'Already done move',
      description: 'This move was already completed.',
      dueDate: '2025-08-16T00:00:00.000Z',
      progress: 100,
      status: 'completed',
      priority: 'medium',
      isCompleted: true,
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
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z'
    };

    const reopenedMove = {
      ...completedMove,
      isCompleted: false,
      progress: 100,
      status: 'in-progress',
      updatedAt: '2026-05-31T00:00:00.000Z'
    };

    stubFirestore();

    cy.intercept( 'GET', '**/moves', {
      statusCode: 200,
      body: { tasks: [completedMove] }
    } ).as( 'loadMoves' );

    cy.intercept( 'PUT', `**/moves/${completedMove.id}`, ( req ) => {
      expect( req.body.isCompleted ).to.equal( false );
      req.reply( { statusCode: 200, body: { task: reopenedMove } } );
    } ).as( 'uncompleteMove' );

    cy.visitWithCypressAuth( '/moves-view', signedInUser );
    cy.get( '[data-cy="moves-tab-browser"]' ).click();
    cy.get( '[data-cy="moves-view-checklist"]', { timeout: 10000 } ).should( 'be.visible' ).click();

    cy.get( '[data-cy="moves-checklist-completed-list"]' ).should( 'be.visible' );
    cy.get( `[data-cy="moves-checklist-toggle-${completedMove.id}"]` ).click();

    cy.wait( '@uncompleteMove' );

    cy.get( `[data-cy="moves-checklist-item-${reopenedMove.id}"]` ).should( 'be.visible' );
    cy.get( `[data-cy="moves-checklist-completed-item-${completedMove.id}"]` ).should( 'not.exist' );
  } );
} );
