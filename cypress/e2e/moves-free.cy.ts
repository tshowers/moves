/**
 * "Browse free, create with the app" (Ty, 2026-09-28): anyone can look at
 * every Moves page; creating and editing needs the Moves App Store
 * subscription (or the master tenant). Replaces the old 10-free-Moves /
 * Stripe checkout specs.
 */
describe( 'Moves browse-free, create-with-the-app', () => {
  const signedInUser = {
    uid: 'moves-browse-user',
    tenantId: 'moves-browse-tenant',
    email: 'moves-browse@example.com',
  };

  const stubAccess = ( canWrite: boolean ) => {
    cy.intercept( { hostname: 'firestore.googleapis.com' }, { statusCode: 403, body: {} } );
    cy.intercept( 'GET', '**/moves/limits', {
      statusCode: 200,
      body: { success: true, limits: { isPaidUser: canWrite, currentCount: 0, freeMoveLimit: 0, remainingFreeMoves: 0, canCreateMove: canWrite } },
    } ).as( 'limits' );
    cy.intercept( 'GET', '**/account/summary*', {
      statusCode: 200,
      body: { success: true, data: { tenant: {}, writeAccess: { moves: canWrite } } },
    } ).as( 'summary' );
  };

  it( 'explains the model on /pricing', () => {
    cy.visit( '/pricing' );
    cy.get( '[data-cy="get-the-app"]' ).should( 'be.visible' );
    cy.contains( 'Browse Moves free' ).should( 'exist' );
    cy.get( '[data-cy="get-the-app-faq"]' ).should( 'contain.text', 'Not yet.' );
  } );

  it( 'sends old Stripe checkout links to the app', () => {
    cy.visit( '/success?session_id=old-session' );
    cy.location( 'pathname' ).should( 'eq', '/app' );
  } );

  it( 'lets a signed-in user without the app look, but not save', () => {
    stubAccess( false );
    cy.visitWithCypressAuth( '/move', signedInUser );
    cy.get( '[data-cy="moves-edit-shell"]' ).should( 'be.visible' );
    cy.get( '[data-cy="moves-get-the-app-banner"]' ).should( 'contain.text', 'Get the Moves app to create and edit' );
    cy.get( '[data-cy="moves-get-the-app-link"]' ).should( 'have.attr', 'href', '/pricing' );
    cy.get( '[data-cy="moves-edit-title"]' ).type( 'Call the printer' );
    cy.get( '[data-cy="moves-edit-save-top"]' ).should( 'be.disabled' );
  } );

  it( 'shows the Move planned in /get-started as waiting', () => {
    stubAccess( false );
    cy.visitWithCypressAuth( '/move', signedInUser, {
      onBeforeLoad: ( win ) => {
        win.localStorage.setItem( 'moves_signup_draft', JSON.stringify( { title: 'Send a proposal', readyToSubmit: true } ) );
      },
    } );
    cy.get( '[data-cy="moves-get-the-app-banner"]' ).should( 'contain.text', '"Send a proposal", is waiting' );
  } );

  it( 'lets a user with the app save', () => {
    stubAccess( true );
    cy.visitWithCypressAuth( '/move', signedInUser );
    cy.get( '[data-cy="moves-edit-shell"]' ).should( 'be.visible' );
    cy.wait( '@limits' );
    cy.get( '[data-cy="moves-edit-title"]' ).type( 'Call the printer' );
    cy.get( '[data-cy="moves-edit-save-top"]' ).should( 'not.be.disabled' );
    cy.get( '[data-cy="moves-get-the-app-banner"]' ).should( 'not.exist' );
  } );
} );
