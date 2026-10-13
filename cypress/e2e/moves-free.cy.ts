/**
 * "Browse free, create with the app" (Ty, 2026-09-28): anyone can look at
 * every Moves page; creating and editing needs the Moves App Store
 * subscription (or the master tenant). The write gate inside the flow map
 * is covered in moves.cy.ts.
 */
describe( 'Moves browse-free, create-with-the-app', () => {
  it( 'explains the model on /pricing', () => {
    cy.visit( '/pricing' );
    cy.get( '[data-cy="get-the-app"]' ).should( 'be.visible' );
    cy.contains( 'Browse Moves free' ).should( 'exist' );
    cy.get( '[data-cy="get-the-app-faq"]' ).should( 'contain.text', 'Subscribe here with a card' );
  } );

  it( 'sends old Stripe checkout links to the app', () => {
    cy.visit( '/success?session_id=old-session' );
    cy.location( 'pathname' ).should( 'eq', '/app' );
  } );
} );
