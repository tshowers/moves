describe( 'Moves help (/help)', () => {
  it( 'orients a new visitor before the walkthrough', () => {
    cy.visit( '/help' );
    cy.get( '[data-cy="help-shell"]' ).should( 'be.visible' );

    // New-user orientation comes first, in this order.
    const headings = [
      'help-what-title',
      'help-who-title',
      'help-why-title',
      'help-first-title',
      'help-todd-title',
      'help-terms-title',
      'help-start-title',
    ];
    cy.get( 'h2[id]' ).then( ( $h2 ) => {
      const ids = [ ...$h2 ].map( ( el ) => el.id ).filter( ( id ) => headings.includes( id ) );
      expect( ids ).to.deep.equal( headings );
    } );

    cy.get( '.help-persona' ).should( 'have.length', 4 );
    cy.get( '.help-contrast__row' ).not( '.help-contrast__row--head' ).should( 'have.length', 5 );
    cy.get( '.help-quickstart li' ).should( 'have.length', 4 );
    cy.get( '.help-terms dt' ).should( 'contain', 'Move' ).and( 'contain', 'AI Missions' );
    cy.get( '.help-step' ).should( 'have.length', 6 );
  } );

  it( 'starts a new user by creating a Move', () => {
    cy.visit( '/help' );
    cy.contains( '.help-quickstart a', 'New Move' ).should( 'have.attr', 'href', '/move' );
    cy.contains( '.help-quickstart a', 'Sign in' ).should( 'have.attr', 'href', '/login' );
  } );
} );
