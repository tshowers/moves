describe( 'Moves paid workflows', () => {
  const signedInUser = {
    uid: 'moves-paid-user',
    tenantId: 'moves-paid-tenant',
    email: 'moves-paid@example.com',
    paid: true
  };

  it( 'lets a signed-in user start the Moves checkout flow', () => {
    cy.intercept( 'POST', '**/moves/checkout', ( req ) => {
      expect( req.body ).to.deep.equal( {
        tenantId: signedInUser.tenantId,
        email: signedInUser.email
      } );

      req.reply( {
        statusCode: 200,
        body: {
          success: true,
          url: '/success?session_id=moves-paid-session'
        }
      } );
    } ).as( 'startMovesCheckout' );

    cy.visitWithCypressAuth( '/pricing', signedInUser );
    cy.get( '[data-cy="moves-pricing-email"]' ).should( 'have.value', signedInUser.email );
    cy.get( '[data-cy="moves-pricing-subscribe"]' ).click();

    cy.wait( '@startMovesCheckout' );
    cy.location( 'pathname' ).should( 'eq', '/success' );
    cy.location( 'search' ).should( 'include', 'session_id=moves-paid-session' );
  } );

  it( 'confirms a paid subscription and sends the user back to Moves', () => {
    cy.intercept( 'POST', '**/moves/checkout/confirm', {
      statusCode: 200,
      body: {
        success: true
      }
    } ).as( 'confirmMovesCheckout' );

    cy.visit( '/success?session_id=moves-paid-session' );
    cy.wait( '@confirmMovesCheckout' );

    cy.get( '[data-cy="moves-success-active"]' ).should( 'be.visible' );
    cy.contains( 'Moves access is now active' ).should( 'exist' );
    cy.get( '[data-cy="moves-success-go-to-moves"]' ).click();
    cy.location( 'pathname' ).should( 'eq', '/app' );
  } );
} );
