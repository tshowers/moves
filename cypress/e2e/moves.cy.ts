describe( 'Moves UI smoke', () => {
  const signedInUser = {
    uid: 'moves-smoke-user',
    tenantId: 'moves-smoke-tenant',
    email: 'moves-smoke@example.com',
    paid: true,
  };

  const sampleMoves = [
    {
      id: 'smoke-move-1',
      title: 'Follow up with procurement',
      status: 'not-started',
      priority: 'high',
      progress: 0,
      isCompleted: false,
      ownerId: signedInUser.uid,
      tenantId: signedInUser.tenantId,
    },
    {
      id: 'smoke-move-2',
      title: 'Send contract to legal',
      status: 'in-progress',
      priority: 'medium',
      progress: 50,
      isCompleted: false,
      ownerId: signedInUser.uid,
      tenantId: signedInUser.tenantId,
    },
  ];

  it( 'loads the main Moves public shells', () => {
    cy.visit( '/app' );
    cy.get( '[data-cy="moves-home-shell"]' ).should( 'be.visible' );

    cy.visit( '/pricing' );
    cy.get( '[data-cy="moves-pricing-page"]' ).should( 'be.visible' );

    cy.visit( '/success' );
    cy.get( '[data-cy="moves-success-page"]' ).should( 'be.visible' );
  } );

  it( 'renders the moves cockpit with list data for an authenticated user', () => {
    cy.intercept( 'GET', '**/moves', {
      statusCode: 200,
      body: { tasks: sampleMoves },
    } ).as( 'loadMoves' );

    cy.visitWithCypressAuth( '/moves-view', signedInUser );
    cy.wait( '@loadMoves' );

    cy.get( '[data-cy="moves-cockpit-shell"]' ).should( 'be.visible' );
    // task-view-parent.component.ts defaults activeTab to 'overview' - the
    // filter input, move list, and view switcher only render inside the
    // Move Browser tab.
    cy.get( '[data-cy="moves-tab-browser"]' ).click();
    cy.get( '[data-cy="moves-filter-input"]' ).should( 'be.visible' );
    cy.get( '[data-cy="moves-create-button"]' ).should( 'be.visible' );
    cy.contains( 'Follow up with procurement' ).should( 'exist' );
    cy.contains( 'Send contract to legal' ).should( 'exist' );
  } );

  it( 'shows empty state when authenticated user has no moves', () => {
    cy.intercept( 'GET', '**/moves', {
      statusCode: 200,
      body: { tasks: [] },
    } ).as( 'loadMoves' );

    cy.visitWithCypressAuth( '/moves-view', signedInUser );
    cy.wait( '@loadMoves' );

    cy.get( '[data-cy="moves-tab-browser"]' ).click();
    cy.get( '[data-cy="moves-empty-state"]' ).should( 'be.visible' );
    cy.get( '[data-cy="moves-empty-state-cta"]' ).should( 'be.visible' );
  } );

  it( 'filters the move list when text is typed in the search input', () => {
    cy.intercept( 'GET', '**/moves', {
      statusCode: 200,
      body: { tasks: sampleMoves },
    } ).as( 'loadMoves' );

    cy.visitWithCypressAuth( '/moves-view', signedInUser );
    cy.wait( '@loadMoves' );

    cy.get( '[data-cy="moves-tab-browser"]' ).click();
    cy.get( '[data-cy="moves-filter-input"]' ).type( 'procurement' );
    cy.contains( 'Follow up with procurement' ).should( 'exist' );
    cy.contains( 'Send contract to legal' ).should( 'not.exist' );
  } );
} );
