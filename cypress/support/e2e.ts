// You can add custom commands or global hooks here
import './commands';

// Prevent AUT-level uncaught exceptions (e.g. Firebase init, zone.js async errors)
// from failing tests. The doesAUTMatchTopSuperDomainOrigin TypeError is a
// Cypress internal snapshot issue triggered when the AUT loads cross-origin
// resources — suppressing AUT exceptions stops it from cascading.
Cypress.on( 'uncaught:exception', () => false );
