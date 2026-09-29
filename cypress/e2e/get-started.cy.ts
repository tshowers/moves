/**
 * Moves' pre-sign-in wizard at /get-started: plan a first Move (what,
 * when, how important), then name, then hand off to TODD's hosted login.
 * The draft is kept in localStorage so it survives that redirect (it's
 * saved after sign-in by MovesSignupDraftService.submitIfPending).
 */
describe( 'Moves get started wizard', () => {
  const storageKey = 'moves_signup_draft';

  beforeEach( () => cy.clearLocalStorage() );

  it( 'plans a Move, asks for a name, and saves the draft', () => {
    cy.visit( '/get-started' );
    cy.get( '[data-cy="get-started-progress"] li' ).should( 'have.length', 4 );
    cy.get( '[data-cy="get-started-progress"] li' ).eq( 0 ).should( 'have.class', 'is-done' );

    // A Move is preselected, so Next works straight away.
    cy.contains( '[data-cy="get-started-starter"]', 'Follow up with a lead' ).should( 'have.attr', 'aria-checked', 'true' );
    cy.contains( '[data-cy="get-started-starter"]', 'Send a proposal' ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();

    cy.contains( '[data-cy="get-started-question"]', 'When should it be done?' );
    cy.contains( '[data-cy="get-started-when"]', 'Tomorrow' ).should( 'have.attr', 'aria-checked', 'true' );
    cy.contains( '[data-cy="get-started-when"]', 'This week' ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();

    cy.contains( '[data-cy="get-started-question"]', 'How important is it?' );
    cy.contains( '[data-cy="get-started-priority"]', 'Urgent' ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();

    cy.get( '[data-cy="get-started-preview"]' ).should( 'contain.text', 'Send a proposal' )
      .and( 'contain.text', 'Urgent' ).and( 'contain.text', 'Due' );
    cy.get( '[data-cy="get-started-next"]' ).should( 'contain.text', 'Continue to sign up' ).click();

    cy.get( '[data-cy="get-started-progress"] li' ).eq( 1 ).should( 'have.class', 'is-done' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Ada{enter}' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Lovelace{enter}' );

    cy.contains( '[data-cy="get-started-question"]', 'create your account' );
    cy.window().then( ( win ) => {
      const draft = JSON.parse( win.localStorage.getItem( storageKey ) || '{}' );
      expect( draft ).to.include( {
        starterKey: 'proposal', title: 'Send a proposal', whenKey: 'thisWeek', priority: 'urgent',
        firstName: 'Ada', lastName: 'Lovelace', readyToSubmit: true,
      } );
    } );

    cy.get( '[data-cy="get-started-sign-in"]' ).click();
    cy.location( 'href', { timeout: 10000 } ).should( 'include', 'todd.taliferro.tech/login' );
  } );

  it( '"Other" asks for the Move', () => {
    cy.visit( '/get-started' );
    cy.contains( '[data-cy="get-started-starter"]', 'Other' ).click();
    cy.get( '[data-cy="get-started-next"]' ).should( 'be.disabled' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Renew the domain' );
    cy.get( '[data-cy="get-started-next"]' ).should( 'not.be.disabled' );
  } );

  it( 'links returning users straight to sign-in', () => {
    cy.visit( '/get-started' );
    cy.get( '[data-cy="get-started-existing"]' ).should( 'have.attr', 'href' ).and( 'include', '/login' );
  } );
} );
