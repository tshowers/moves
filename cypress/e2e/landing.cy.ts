/**
 * The home page carries the shared chrome (PRODUCT-STANDARD.md): the
 * universal menu inline in its nav, ⌘K search, "Powered by TODD · Also
 * from us", and the site footer.
 */
describe( 'Moves home page', () => {
  it( 'has exactly one Menu button, and it opens the universal menu', () => {
    cy.visit( '/' );
    cy.get( '.um-trigger' ).should( 'have.length', 1 ).click();
    cy.get( '.um-panel' ).should( 'be.visible' ).and( 'contain.text', 'Momentum' );
  } );

  it( 'keeps one Menu button after jumping to a section (/#signal)', () => {
    cy.visit( '/' );
    cy.contains( 'a', 'The signal' ).click();
    cy.location( 'hash' ).should( 'eq', '#signal' );
    cy.get( '.um-trigger' ).should( 'have.length', 1 );
  } );

  it( 'shows the demo video beside the quote, and hides the frame if it can’t load', () => {
    cy.visit( '/' );
    cy.get( '.moves-quote__copy' ).should( 'contain.text', 'What needs attention?' );
    cy.get( '.moves-quote__video' ).should( 'have.attr', 'src' ).and( 'match', /moves-todd-demo-(light|dark)\.mp4$/ );
    // A load error (file missing or broken). Fired directly: blocking the URL
    // doesn't work once an earlier test has the real file in the media cache.
    cy.get( '.moves-quote__video' ).then( ( $v ) => $v[0].dispatchEvent( new Event( 'error' ) ) );
    cy.get( '.moves-quote__media' ).should( 'not.exist' );
  } );

  it( 'opens the search with ⌘K and finds a Moves page', () => {
    cy.visit( '/' );
    cy.get( '.um-trigger' ).should( 'be.visible' );
    cy.get( 'body' ).type( '{meta}k' );
    cy.focused().type( 'weekly review' );
    cy.contains( 'Weekly review' ).should( 'be.visible' );
  } );

  it( 'credits TODD, suggests another product, and ends with the footer', () => {
    cy.visit( '/' );
    cy.get( '.moves-made-by' ).should( 'contain.text', 'Powered by TODD' );
    cy.get( 'a[appAlsoFromUs]' ).should( 'contain.text', 'Also from us' ).and( 'have.attr', 'href' ).and( 'not.include', 'moves.taliferro.tech' );
    cy.get( '.tt-foot' ).should( 'contain.text', 'Taliferro Tech' ).and( 'contain.text', 'Help' );
  } );
} );
