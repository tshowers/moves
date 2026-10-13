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
