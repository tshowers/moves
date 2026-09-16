describe( 'Move subtasks', () => {
  const signedInUser = {
    uid: 'moves-subtasks-user',
    tenantId: 'moves-subtasks-tenant',
    email: 'moves-subtasks@example.com',
    paid: true
  };

  // Same Firestore short-circuit moves-crud.cy.ts uses - contacts/projects/
  // task-types/documents dropdowns all read Firestore directly (see
  // moves-data.service.ts), so this keeps that load from hanging.
  const stubFirestore = () => {
    cy.intercept( { hostname: 'firestore.googleapis.com' }, { statusCode: 403, body: {} } );
  };

  it( 'adds a subtask from an existing move and reopens it from the parent\'s subtask list', () => {
    const parentTask = {
      id: 'move-parent-1',
      title: 'Launch the referral program',
      description: 'Coordinate the referral program launch.',
      dueDate: '2026-05-10T00:00:00.000Z',
      progress: 20,
      status: 'in-progress',
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
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z'
    };

    const childTask = {
      ...parentTask,
      id: 'move-child-1',
      title: 'Write the referral program terms',
      description: 'Draft the terms before legal review.',
      status: 'not-started',
      progress: 0,
      parentTaskId: parentTask.id
    };

    stubFirestore();

    cy.intercept( 'GET', `**/moves/${parentTask.id}`, {
      statusCode: 200,
      body: { task: parentTask }
    } ).as( 'getParent' );

    // loadChildTasks() has no server-side filter - it loads every move for
    // the tenant via the same list endpoint the cockpit uses, then filters
    // client-side by parentTaskId. Starts with no children.
    cy.intercept( 'GET', '**/moves', {
      statusCode: 200,
      body: { tasks: [parentTask] }
    } ).as( 'loadMoves' );

    cy.visitWithCypressAuth( `/move/${parentTask.id}`, signedInUser );
    cy.wait( '@getParent' );
    cy.wait( '@loadMoves' );

    cy.contains( 'h3', 'Subtasks' ).should( 'be.visible' );
    cy.contains( 'No subtasks yet. Add one to break this move into smaller steps.' ).should( 'be.visible' );

    cy.get( '[data-cy="moves-edit-add-subtask"]' ).click();
    cy.location( 'pathname' ).should( 'eq', '/move' );
    cy.location( 'search' ).should( 'include', `parentTaskId=${parentTask.id}` );
    cy.get( '[data-cy="moves-edit-shell"]' ).should( 'be.visible' );

    cy.intercept( 'POST', '**/moves', ( req ) => {
      expect( req.body.parentTaskId ).to.equal( parentTask.id );
      expect( req.body.title ).to.equal( childTask.title );
      req.reply( { statusCode: 200, body: { task: childTask } } );
    } ).as( 'createSubtask' );

    cy.get( '[data-cy="moves-edit-title"]' ).type( childTask.title );
    cy.get( '[data-cy="moves-edit-description"]' ).type( childTask.description );
    cy.get( '[data-cy="moves-edit-save-top"]' ).click();
    cy.wait( '@createSubtask' );
    cy.contains( '.toast-header', 'Move Saved' ).should( 'exist' );

    // Re-stub the list so the parent's subtask panel finds the new child
    // when we reopen it.
    cy.intercept( 'GET', '**/moves', {
      statusCode: 200,
      body: { tasks: [parentTask, childTask] }
    } ).as( 'loadMovesWithChild' );

    cy.visit( `/move/${parentTask.id}` );
    cy.wait( '@getParent' );
    cy.wait( '@loadMovesWithChild' );

    cy.contains( 'No subtasks yet' ).should( 'not.exist' );
    cy.contains( 'li', childTask.title ).should( 'be.visible' );
    cy.contains( 'li', childTask.title ).should( 'contain', 'Status: not-started' );

    cy.intercept( 'GET', `**/moves/${childTask.id}`, {
      statusCode: 200,
      body: { task: childTask }
    } ).as( 'getChild' );

    cy.contains( 'li', childTask.title ).find( 'button' ).contains( 'Open Move' ).click();
    cy.location( 'pathname' ).should( 'eq', `/move/${childTask.id}` );
    cy.wait( '@getChild' );
    cy.get( '[data-cy="moves-edit-title"]' ).should( 'have.value', childTask.title );

    // A subtask can't itself show a nested Subtasks panel.
    cy.contains( 'h3', 'Subtasks' ).should( 'not.exist' );
  } );

  it( 'hides the Subtasks panel while creating a brand-new move', () => {
    stubFirestore();
    cy.intercept( 'GET', '**/moves', { statusCode: 200, body: { tasks: [] } } );

    cy.visitWithCypressAuth( '/move', signedInUser );
    cy.get( '[data-cy="moves-edit-shell"]' ).should( 'be.visible' );
    cy.contains( 'h3', 'Subtasks' ).should( 'not.exist' );
  } );
} );
