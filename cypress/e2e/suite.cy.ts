/**
 * TODD Suite ($99/mo, every app - Ty 2026-10-21) from Moves's /pricing:
 * the Suite card, the shared write-access prompt, and Stripe checkout
 * through todd-backend /api/billing/checkout (product "suite"). Stripe and
 * the backend are stubbed here; cypress/e2e in taliferrotech/frontend has
 * the on-demand run against real Stripe test mode.
 */
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_suite';

describe( 'TODD Suite on Moves /pricing', () => {
  it( 'offers Suite at $99/month next to the Moves plan', () => {
    cy.visit( '/pricing' );
    cy.get( '[data-cy="get-the-app"]' ).should( 'be.visible' );
    cy.get( '[data-cy="get-the-app-suite"]' )
      .should( 'contain.text', '16Ahead Suite' )
      .and( 'contain.text', '$99' )
      .and( 'contain.text', 'Network, Pulse, and Docs & Knowledge' )
      .and( 'contain.text', 'The Marketing Assistant and Social' )
      .and( 'contain.text', '10x the daily Image Creator and Email Creator allowance' );
  } );

  it( 'asks a signed-out visitor to sign in first, and brings them back to pricing', () => {
    cy.visit( '/pricing' );
    cy.get( '[data-cy="get-the-app-suite-subscribe"]' ).click();
    cy.get( '[data-cy="write-access-prompt"]' ).should( 'contain.text', 'Sign in to get 16Ahead Suite' );
    cy.get( '[data-cy="write-access-prompt"]' ).contains( 'button', 'Sign in' ).click();
    cy.location( 'pathname' ).should( 'eq', '/get-started' );
    cy.location( 'search' ).should( 'include', 'returnUrl=%2Fpricing' );
  } );
} );

/** MovesAuthService's Cypress-only override (cypress/support/commands.ts). */
const visitSignedIn = ( path: string ) => {
  cy.intercept( { hostname: 'firestore.googleapis.com' }, { statusCode: 403, body: {} } );
  return cy.visitWithCypressAuth( path, { uid: 'suite-buyer', email: 'suite-buyer@example.com' } );
};

describe( 'TODD Suite: a signed-in Moves user buys it', () => {
  /** Flips once "Stripe" takes the payment; /billing/status then reports Suite. */
  let paid = false;
  const tab = { closed: false, location: { href: '' }, close () { this.closed = true; } };

  beforeEach( () => {
    paid = false;
    tab.closed = false;
    tab.location.href = '';
    cy.intercept( 'GET', '**/account/summary*', { statusCode: 200, body: { success: true, data: { tenant: {}, writeAccess: { moves: false } } } } );
    cy.intercept( 'GET', '**/billing/status', ( req ) => req.reply( {
      success: true,
      writeAccess: { network: paid, pulse: paid, docs: paid, moves: paid, outreach: paid, social: paid, maya: paid, suite: paid },
    } ) ).as( 'status' );
    cy.intercept( 'POST', '**/billing/checkout', { statusCode: 200, body: { success: true, url: CHECKOUT_URL, sessionId: 'cs_test_suite' } } ).as( 'checkout' );
  } );

  it( 'pricing -> Suite -> Stripe in a new tab -> every app unlocked', () => {
    visitSignedIn( '/pricing' );
    cy.window().then( ( win ) => cy.stub( win, 'open' ).as( 'open' ).returns( tab ) );

    cy.get( '[data-cy="get-the-app-suite"]' ).should( 'contain.text', '$99' );
    cy.get( '[data-cy="get-the-app-suite-subscribe"]' ).click();
    cy.get( '[data-cy="write-access-prompt"]' ).should( 'contain.text', 'Get 16Ahead Suite' ).and( 'contain.text', '$99/month' );
    cy.get( '[data-cy="write-access-subscribe-suite"]' ).click();

    cy.get( '@open' ).should( 'have.been.calledWith', '', '_blank' );
    cy.wait( '@checkout' ).then( ( { request } ) => {
      expect( request.body.product ).to.equal( 'suite' );
      expect( request.body.resume ).to.equal( 'tab' );
      expect( request.body.returnUrl ).to.match( /\/pricing$/ );
    } );
    cy.wrap( tab ).its( 'location.href' ).should( 'equal', CHECKOUT_URL );
    cy.get( '[data-cy="write-access-prompt"]' ).should( 'contain.text', 'Finish checkout in the new tab' ).then( () => {
      paid = true;
    } );

    cy.get( '[data-cy="write-access-prompt"]', { timeout: 15000 } )
      .should( 'contain.text', 'You’re subscribed to 16Ahead Suite' )
      .and( 'contain.text', 'Every 16Ahead app is unlocked' );
  } );

  it( 'the Moves subscribe prompt offers Suite as the alternative', () => {
    visitSignedIn( '/pricing' );
    cy.window().then( ( win ) => cy.stub( win, 'open' ).returns( tab ) );
    cy.get( '[data-cy="get-the-app-subscribe"]' ).click();
    cy.get( '[data-cy="write-access-suite"]' ).should( 'contain.text', '16Ahead Suite · $99/mo' ).click();
    cy.wait( '@checkout' ).its( 'request.body.product' ).should( 'equal', 'suite' );
  } );

  it( 'coming back from Stripe in the same tab confirms Suite', () => {
    paid = true;
    visitSignedIn( '/pricing?checkout=success&product=suite&session_id=cs_test_suite' );
    cy.get( '[data-cy="write-access-prompt"]', { timeout: 15000 } ).should( 'contain.text', 'You’re subscribed to 16Ahead Suite' );
    cy.location( 'search' ).should( 'not.contain', 'checkout=' );
  } );

  it( 'a Suite subscriber sees it instead of a buy button', () => {
    paid = true;
    visitSignedIn( '/pricing' );
    cy.get( '[data-cy="get-the-app-suite-active"]' ).should( 'contain.text', 'You have 16Ahead Suite' );
    cy.get( '[data-cy="get-the-app-suite-subscribe"]' ).should( 'not.exist' );
  } );

  it( 'someone who already has Suite isn’t charged twice', () => {
    cy.intercept( 'POST', '**/billing/checkout', { statusCode: 409, body: { success: false, code: 'ALREADY_ENTITLED', message: 'You already have 16Ahead Suite.' } } ).as( 'checkout' );
    visitSignedIn( '/pricing' );
    cy.window().then( ( win ) => cy.stub( win, 'open' ).returns( tab ) );
    cy.get( '[data-cy="get-the-app-suite-subscribe"]' ).click();
    cy.get( '[data-cy="write-access-subscribe-suite"]' ).click();
    cy.wait( '@checkout' );
    // ALREADY_ENTITLED means Suite is on: the prompt finishes instead of charging again.
    cy.get( '[data-cy="write-access-prompt"]' ).should( 'contain.text', 'You’re subscribed to 16Ahead Suite' );
    cy.wrap( tab ).its( 'closed' ).should( 'equal', true );
  } );
} );
