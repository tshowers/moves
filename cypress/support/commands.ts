/**
 * Trimmed port of TODD's cypress/support/commands.ts - only the auth
 * override commands the Moves specs actually use. TODD's file also has
 * SayIt/contacts/response-flow/admin/affiliate helpers for other
 * products' specs, none of which apply here.
 *
 * setCypressAuthOverride/visitWithCypressAuth work by writing
 * `__cypressAuthOverride` to localStorage before the app boots.
 * MovesAuthService only reads it when `window.Cypress` is present (see
 * getCypressAuthOverride() there), so this has no effect outside a
 * Cypress-driven browser - never in production, never in normal dev use.
 */
type CypressAuthOverride = {
  uid: string;
  tenantId?: string;
  email?: string;
  paid?: boolean;
};

declare global {
  namespace Cypress {
    interface Chainable {
      setCypressAuthOverride ( override: CypressAuthOverride ): Chainable<void>;
      clearCypressAuthOverride (): Chainable<void>;
      visitWithCypressAuth ( path: string, override: CypressAuthOverride, options?: Partial<Cypress.VisitOptions> ): Chainable<AUTWindow>;
    }
  }
}

Cypress.Commands.add( 'setCypressAuthOverride', ( override: CypressAuthOverride ) => {
  cy.window().then( ( win ) => {
    const resolvedEmail = override.email || `${override.uid}@example.com`;
    win.localStorage.setItem( '__cypressAuthOverride', JSON.stringify( {
      uid: override.uid,
      tenantId: override.tenantId || override.uid,
      email: resolvedEmail,
    } ) );
    win.localStorage.setItem( 'userEmail', resolvedEmail );
    win.sessionStorage.setItem( 'userEmail', resolvedEmail );

    if ( override.paid ) {
      win.localStorage.setItem( 'surveyPaidAccess', 'true' );
      win.sessionStorage.setItem( 'surveyPaidAccess', 'true' );
    } else {
      win.localStorage.removeItem( 'surveyPaidAccess' );
      win.sessionStorage.removeItem( 'surveyPaidAccess' );
    }
  } );
} );

Cypress.Commands.add( 'clearCypressAuthOverride', () => {
  cy.window().then( ( win ) => {
    win.localStorage.removeItem( '__cypressAuthOverride' );
    win.localStorage.removeItem( 'userEmail' );
    win.localStorage.removeItem( 'surveyPaidAccess' );
    win.sessionStorage.removeItem( 'userEmail' );
    win.sessionStorage.removeItem( 'surveyPaidAccess' );
  } );
} );

Cypress.Commands.add( 'visitWithCypressAuth', ( path: string, override: CypressAuthOverride, options?: Partial<Cypress.VisitOptions> ) => {
  return cy.visit( path, {
    ...options,
    onBeforeLoad: ( win ) => {
      const resolvedEmail = override.email || `${override.uid}@example.com`;
      win.localStorage.setItem( '__cypressAuthOverride', JSON.stringify( {
        uid: override.uid,
        tenantId: override.tenantId || override.uid,
        email: resolvedEmail,
      } ) );
      win.localStorage.setItem( 'userEmail', resolvedEmail );
      win.sessionStorage.setItem( 'userEmail', resolvedEmail );

      if ( override.paid ) {
        win.localStorage.setItem( 'surveyPaidAccess', 'true' );
        win.sessionStorage.setItem( 'surveyPaidAccess', 'true' );
      } else {
        win.localStorage.removeItem( 'surveyPaidAccess' );
        win.sessionStorage.removeItem( 'surveyPaidAccess' );
      }

      if ( options?.onBeforeLoad ) {
        options.onBeforeLoad( win );
      }
    },
  } );
} );

export { };
