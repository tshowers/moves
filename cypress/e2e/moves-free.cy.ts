describe( 'Moves free-plan workflows', () => {
  const freeUser = {
    uid: 'moves-free-user',
    tenantId: 'moves-free-tenant',
    email: 'moves-free@example.com',
    paid: false
  };

  it( 'shows the guest purchase gate on Moves pricing', () => {
    cy.visit( '/pricing' );
    cy.get( '[data-cy="moves-pricing-page"]' ).should( 'be.visible' );
    cy.contains( 'Free includes 2 moves. Paid lets you keep momentum going.' ).should( 'exist' );
    cy.contains( 'Sign in first' ).should( 'exist' );

    cy.get( '[data-cy="moves-pricing-sign-in"]' ).click();

    // See the equivalent assertion in moves-auth.cy.ts: SignInComponent
    // auto-fires signIn() on load, which hands off to a different origin
    // immediately - there's no stable post-navigation state for Cypress
    // to reliably read here (two attempts both hit real Cypress-internal
    // failures racing that navigation). The returnUrl/CSRF-token behavior
    // is covered by moves-auth.service.spec.ts instead; this only checks
    // what Cypress can reliably observe.
    cy.location( 'pathname' ).should( 'eq', '/login' );
  } );

  it( 'shows the real free-plan save wall when a tenant is already at the move limit', () => {
    cy.intercept( { hostname: 'firestore.googleapis.com' }, { statusCode: 403, body: {} } );

    cy.intercept( 'POST', '**/moves', {
      statusCode: 403,
      body: {
        message: 'Free plan allows up to 2 tasks.'
      }
    } ).as( 'createMoveRejected' );

    cy.visitWithCypressAuth( '/move', freeUser );
    cy.get( '#preloader', { timeout: 8000 } ).should( 'not.exist' );
    cy.get( '[data-cy="moves-edit-shell"]' ).should( 'be.visible' );
    cy.get( '[data-cy="moves-edit-title"]' ).type( 'Third free move' );
    cy.get( '[data-cy="moves-edit-description"]' ).type( 'This should stop at the real free quota.' );
    cy.get( '[data-cy="moves-edit-save-top"]' ).click();

    cy.wait( '@createMoveRejected' );
    cy.contains( '.toast-header', 'Save Failed' ).should( 'exist' );
    cy.contains( 'Free plan allows up to 2 tasks.' ).should( 'exist' );
    cy.get( '[data-cy="moves-edit-delete"]' ).should( 'not.exist' );
  } );
} );
