/**
 * Every playbook, start to finish, in the browser (Ty, 2026-10-21).
 *
 * One test per playbook: open its Mission, press Start, and every time the
 * Mission waits on you, open the step from the banner and do what a person
 * would in the step drawer - Approve, pick the first option, type an answer,
 * "They replied", or Mark done - until the report appears with nothing failed.
 *
 * The frames are written by todd-backend scripts/missions-fixtures.js: the
 * real runner and catalog (tools TODD can't run yet are handed to you, as in
 * production), one person action at a time. Regenerate after changing the
 * engine or the examples:
 *   cd taliferrotech/todd-backend/functions && node scripts/missions-fixtures.js
 *
 * Watch it run:  npm run e2e -- --headed --browser chrome --spec cypress/e2e/playbooks.cy.ts
 */
import index from '../fixtures/missions/journeys/index.json';

const ME = { uid: 'uid-owner', tenantId: 'tenant-1', paid: true };
const API = 'https://api.taliferro.tech/api';

type Frame = { mission: any; act: { stepId: string; title: string; type: string; ui: string; value: string } };
type Journey = { id: string; title: string; request: string; proposed: any; frames: Frame[]; done: any };

describe( 'Every playbook, start to finish', () => {
  beforeEach( () => {
    cy.intercept( { url: `${API}/**` }, { statusCode: 200, body: {} } );
  } );

  ( index as { id: string; title: string; source: string; actions: number }[] ).forEach( ( entry ) => {
    it( `${entry.title} (${entry.actions} step${entry.actions === 1 ? '' : 's'} for you)`, () => {
      cy.fixture( `missions/journeys/${entry.id}.json` ).then( ( trip: Journey ) => {
        // What GET /missions/:id returns: the plan until Start, then each frame, then the finished Mission.
        let showing: any = trip.proposed;
        let next = 0;
        const advance = () => {
          showing = next < trip.frames.length ? trip.frames[next].mission : trip.done;
          next += 1;
        };
        cy.intercept( 'GET', `${API}/orchestration/missions/${trip.id}`, ( req ) => req.reply( { success: true, mission: showing } ) ).as( 'mission' );
        cy.intercept( 'POST', `${API}/orchestration/missions/${trip.id}/start`, ( req ) => {
          advance();
          req.reply( { statusCode: 202, body: { success: true, mission: { ...trip.proposed, status: 'queued' } } } );
        } ).as( 'start' );
        cy.intercept( 'POST', `${API}/orchestration/missions/${trip.id}/steps/*`, ( req ) => {
          advance();
          req.reply( { statusCode: 202, body: { success: true } } );
        } ).as( 'act' );

        // The plan, then Start.
        cy.visitWithCypressAuth( `/missions/${trip.id}`, ME );
        cy.get( '[data-cy="mission-title"]' ).should( 'contain.text', trip.title );
        cy.get( '[data-cy="mission-kicker"]' ).should( 'contain.text', 'Not started' );
        cy.get( '[data-cy="start"]' ).click();
        cy.wait( '@start' );

        // Every step that waits on you, done in the drawer.
        trip.frames.forEach( ( frame, i ) => {
          cy.log( `Step for you ${i + 1} of ${trip.frames.length}: ${frame.act.title}` );
          // Wait for this stage to arrive: the banner names the step that's waiting on you.
          const title = frame.act.title.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
          cy.contains( '[data-cy="mission-banner"]', new RegExp( `on you: ${title}`, 'i' ), { timeout: 10000 } );
          cy.get( '[data-cy="banner-cta"]' ).click();
          cy.get( '[data-cy="step-drawer"]' ).should( 'be.visible' ).and( 'contain.text', frame.act.title );
          switch ( frame.act.ui ) {
            case 'approve': cy.get( '[data-cy="drawer-approve"]' ).click(); break;
            case 'option': cy.get( '[data-cy="drawer-option"]' ).first().click(); break;
            case 'answer':
              cy.get( '[data-cy="drawer-note"]' ).type( frame.act.value );
              cy.get( '[data-cy="drawer-answer"]' ).click();
              break;
            case 'replied': cy.get( '[data-cy="drawer-replied"]' ).click(); break;
            default: cy.get( '[data-cy="drawer-done"]' ).click();
          }
          cy.wait( '@act' ).its( 'request.body.type' ).should( 'eq', frame.act.type );
          cy.get( '[data-cy="step-drawer"]' ).should( 'not.exist' );
        } );

        // The report, with every step accounted for.
        cy.get( '[data-cy="mission-report"]', { timeout: 10000 } ).should( 'be.visible' );
        cy.get( '[data-cy="report-row"]' ).should( 'have.length.greaterThan', 0 );
        cy.get( '[data-cy="report-split"]' ).should( 'contain.text', 'by' );
        cy.get( '[data-cy="plan-strip-list"] [data-look="fail"]' ).should( 'not.exist' );
        cy.get( '[data-cy="plan-strip-list"] [data-look="person"]' ).should( 'not.exist' );
        cy.get( '[data-cy="mission-banner"]' ).should( 'not.exist' );
      } );
    } );
  } );
} );
