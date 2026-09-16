describe( 'Moves auth workflows', () => {
  it( 'lets guests explore Moves entry points', () => {
    cy.visit( '/app' );
    cy.get( '[data-cy="moves-home-shell"]' ).should( 'be.visible' );
    cy.contains( 'Execution' ).should( 'exist' );
    cy.contains( 'You are browsing Execution' ).should( 'exist' );

    cy.visit( '/moves-view' );
    cy.get( '[data-cy="moves-cockpit-shell"]' ).should( 'be.visible' );
    // The empty state lives inside the Move Browser tab, not the default
    // Overview tab - see task-view-parent.component.ts's activeTab default.
    cy.get( '[data-cy="moves-tab-browser"]' ).click();
    cy.get( '[data-cy="moves-empty-state"]' ).should( 'be.visible' );
    cy.contains( 'Sign in to create moves, track progress, and keep momentum moving.' ).should( 'exist' );
    cy.get( '[data-cy="moves-empty-state-cta"]' ).should( 'contain', 'Sign In to Create' );
  } );

  it( 'shows the guest save warning while drafting a move', () => {
    cy.visit( '/move' );
    cy.get( '[data-cy="moves-edit-title"]' ).type( 'Guest Move Draft' );
    cy.get( '[data-cy="moves-edit-description"]' ).type( 'A guest can draft, but cannot save until they sign in.' );

    cy.get( '[data-cy="moves-guest-warning"]' ).should( 'be.visible' );
    cy.contains( 'You are building as a guest' ).should( 'exist' );
    cy.contains( 'Your changes will stay on this screen, but they cannot be saved until you sign in.' ).should( 'exist' );
    cy.get( '[data-cy="moves-guest-sign-in"]' ).should( 'be.visible' );
  } );

  it( 'sends guests to login with a returnUrl when they choose Sign In to Save', () => {
    cy.visit( '/move' );
    cy.get( '[data-cy="moves-edit-title"]' ).type( 'Guest Move Draft' );
    cy.get( '[data-cy="moves-guest-sign-in"]' ).click();

    // moves-auth.service.ts's signIn() hands off to TODD's hosted login on
    // a different origin immediately (SignInComponent auto-fires it on
    // load), so there's no stable state left on this origin for Cypress
    // to reliably assert on afterwards - two different attempts at
    // reading/spying on sessionStorage here both hit real Cypress-internal
    // failures racing against that actual cross-origin navigation. That
    // logic (does signIn() stash the right returnUrl + CSRF state token)
    // is covered by a synchronous Karma unit test instead - see
    // moves-auth.service.spec.ts. This only checks the one thing Cypress
    // can reliably observe: the guest lands on the internal /login route.
    cy.location( 'pathname' ).should( 'eq', '/login' );
  } );

  it( 'keeps Save disabled for a guest even with a valid title, so no create request can be sent', () => {
    cy.intercept( 'POST', '**/task*' ).as( 'createTask' );
    cy.intercept( 'POST', '**/moves*' ).as( 'createMove' );

    cy.visit( '/move' );
    cy.get( '[data-cy="moves-edit-title"]' ).type( 'Guest Move Draft' );
    cy.get( '[data-cy="moves-edit-description"]' ).type( 'This should never reach the backend.' );

    cy.get( '[data-cy="moves-edit-save-top"]' ).should( 'be.disabled' );
    cy.get( '[data-cy="moves-edit-save-bottom"]' ).should( 'be.disabled' );

    // A disabled button ignores real clicks; force one anyway to prove the
    // guard is in the button state, not just an assumption about clickability.
    cy.get( '[data-cy="moves-edit-save-bottom"]' ).click( { force: true } );

    cy.get( '@createTask.all' ).should( 'have.length', 0 );
    cy.get( '@createMove.all' ).should( 'have.length', 0 );
  } );
} );
