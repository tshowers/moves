describe( 'Moves route workflows', () => {
  const signedInUser = {
    uid: 'moves-routes-user',
    tenantId: 'moves-routes-tenant',
    email: 'moves-routes@example.com',
    paid: true
  };

  it( 'serves the app home shell from both the app and legacy moves routes', () => {
    // Unlike the TODD monorepo (where Moves is mounted at /moves/* and
    // /moves redirects to /moves/app), this standalone app routes both
    // /app and /moves directly to TaskHomeComponent - no redirect.
    cy.visit( '/app' );
    cy.get( '[data-cy="moves-home-shell"]' ).should( 'be.visible' );

    cy.visit( '/moves' );
    cy.get( '[data-cy="moves-home-shell"]' ).should( 'be.visible' );
  } );

  it( 'opens a move route from the cockpit command view', () => {
    const routeMove = {
      id: 'move-route-1',
      title: 'Route test move',
      description: 'Open this move from the Moves cockpit.',
      dueDate: '2026-04-06T18:00:00.000Z',
      progress: 45,
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
      tenantId: signedInUser.tenantId
    };

    cy.intercept( 'GET', '**/moves', {
      statusCode: 200,
      body: { tasks: [routeMove] }
    } ).as( 'loadMoves' );

    cy.intercept( 'GET', `**/moves/${routeMove.id}`, {
      statusCode: 200,
      body: { task: routeMove }
    } ).as( 'getMove' );

    cy.visitWithCypressAuth( '/moves-view', signedInUser );
    cy.wait( '@loadMoves' );

    // task-view-parent.component.ts defaults activeTab to 'overview', not
    // 'selected' - the "Open Move" button only renders inside the Selected
    // Move tab, even though the first loaded move is auto-selected in the
    // background. The tab must be switched to before this becomes visible.
    cy.get( '[data-cy="moves-tab-selected"]' ).click();
    cy.get( '[data-cy="moves-selected-open"]' ).click();
    cy.location( 'pathname' ).should( 'eq', `/move/${routeMove.id}` );
    cy.get( '[data-cy="moves-edit-shell"]' ).should( 'be.visible' );
    cy.get( '[data-cy="moves-edit-title"]' ).should( 'have.value', routeMove.title );
  } );

  it( 'shows the fallback confirmation state when success is missing session data', () => {
    cy.visit( '/success' );
    cy.get( '[data-cy="moves-success-error"]' ).should( 'be.visible' );
    cy.contains( 'Missing session information. Please try again.' ).should( 'exist' );
  } );
} );
