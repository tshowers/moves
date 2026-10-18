/**
 * Missions in Moves (design_handoff_todd_missions 2a-5a, 8a-13a). The
 * fixtures in cypress/fixtures/missions are written by todd-backend
 * scripts/missions-fixtures.js from the real engine: each example plan run
 * by the runner with simulated tools and people. Regenerate them after
 * changing the engine or the examples:
 *   cd taliferrotech/todd-backend/functions && node scripts/missions-fixtures.js
 */
const ME = { uid: 'uid-owner', tenantId: 'tenant-1', paid: true };
const API = 'https://api.taliferro.tech/api';

function stubApi () {
  // Nothing in these specs may reach the real API.
  cy.intercept( { url: `${API}/**` }, { statusCode: 200, body: {} } ).as( 'anyApi' );
}

function mission ( fixture: string, id = 'reach-named-person' ) {
  cy.fixture( `missions/${fixture}.json` ).then( ( m ) => {
    cy.intercept( 'GET', `${API}/orchestration/missions/${id}`, { success: true, mission: { ...m, id } } ).as( 'mission' );
  } );
}

describe( 'Mission detail (2a)', () => {
  beforeEach( stubApi );

  it( 'waiting on you: the banner says what, and Approve records it', () => {
    mission( 'roland-approval' );
    cy.intercept( 'POST', `${API}/orchestration/missions/reach-named-person/steps/approve`, { statusCode: 202, body: { success: true } } ).as( 'act' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="mission-title"]' ).should( 'contain.text', 'Reach a named person' );
    cy.get( '[data-cy="mission-banner"]' ).should( 'have.attr', 'data-state', 'person' )
      .and( 'contain.text', 'Waiting on you: approve the email' )
      .and( 'contain.text', 'Nothing sends until you approve.' );
    cy.get( '[data-cy="banner-cta"]' ).should( 'have.text', 'Review and approve' ).click();
    cy.get( '[data-cy="step-drawer"]' ).should( 'be.visible' );
    cy.get( '[data-cy="drawer-kicker"]' ).should( 'contain.text', 'Approval' );
    cy.get( '[data-cy="drawer-why"]' ).should( 'contain.text', 'Every send needs your yes.' );
    cy.get( '[data-cy="step-drawer"]' ).should( 'contain.text', "Calder's reporting backlog" );
    cy.get( '[data-cy="drawer-approve"]' ).click();
    cy.wait( '@act' ).its( 'request.body' ).should( 'deep.equal', { type: 'approve' } );
    cy.get( '[data-cy="step-drawer"]' ).should( 'not.exist' );
  } );

  it( 'reject needs a note, and the note goes with it', () => {
    mission( 'roland-approval' );
    cy.intercept( 'POST', `${API}/orchestration/missions/reach-named-person/steps/approve`, { statusCode: 202, body: { success: true } } ).as( 'act' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="banner-cta"]' ).click();
    cy.get( '[data-cy="drawer-reject"]' ).click();
    cy.get( '[data-cy="drawer-send-back"]' ).should( 'be.disabled' );
    cy.get( '[data-cy="step-drawer"]' ).should( 'contain.text', 'Maya revises once and sends it back to you.' );
    cy.get( '[data-cy="drawer-note"]' ).type( 'Shorter, and lead with the Denver office' );
    cy.get( '[data-cy="drawer-send-back"]' ).click();
    cy.wait( '@act' ).its( 'request.body' ).should( 'deep.equal', { type: 'reject', note: 'Shorter, and lead with the Denver office' } );
  } );

  it( 'the full strip shows every step with its owner, and branches as paths', () => {
    mission( 'roland-approval' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="strip-col-who"]' ).should( 'have.attr', 'data-look', 'done' ).and( 'contain.text', 'More than one:' );
    cy.get( '[data-cy="strip-col-approve"]' ).should( 'have.attr', 'data-look', 'person' ).and( 'contain.text', 'Waiting on you' );
    cy.get( '[data-cy="strip-col-send"]' ).should( 'have.attr', 'data-look', 'next' );
    cy.get( '[data-cy="strip-col-branch:afterWait"]' ).should( 'contain.text', 'After the wait' )
      .and( 'contain.text', 'They reply:' ).and( 'contain.text', 'No reply:' ).and( 'contain.text', 'It bounces:' );
    cy.get( '[data-cy="who-does-it"]' ).should( 'contain.text', 'TODD' ).and( 'contain.text', 'Maya' ).and( 'contain.text', 'You' );
  } );

  it( 'Maya working, waiting on the world, and a failure that came to you', () => {
    mission( 'roland-maya-working' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="mission-banner"]' ).should( 'have.attr', 'data-state', 'run' ).and( 'contain.text', 'Maya is working: design the HTML email' );

    mission( 'roland-waiting-world' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="mission-banner"]' ).should( 'have.attr', 'data-state', 'wait' ).and( 'contain.text', 'left' );

    mission( 'roland-failed' );
    cy.intercept( 'POST', `${API}/orchestration/missions/reach-named-person/steps/img`, { statusCode: 202, body: { success: true } } ).as( 'act' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="mission-banner"]' ).should( 'have.attr', 'data-state', 'fail' ).and( 'contain.text', 'A step failed and came to you: make a header image' );
    cy.get( '[data-cy="banner-cta"]' ).click();
    cy.get( '[data-cy="drawer-why"]' ).should( 'contain.text', 'Maya tried 2 times' ).and( 'contain.text', 'brand colors file' );
    cy.get( '[data-cy="drawer-kicker"]' ).should( 'contain.text', 'Task, was tool' );
    cy.get( '[data-cy="drawer-without"]' ).should( 'have.text', 'Design without it' ).click();
    cy.wait( '@act' ).its( 'request.body.type' ).should( 'eq', 'without' );
  } );

  it( 'more than one Roland Martin: you choose, nothing past it has run', () => {
    mission( 'roland-ambiguous' );
    cy.intercept( 'POST', `${API}/orchestration/missions/reach-named-person/steps/pick`, { statusCode: 202, body: { success: true } } ).as( 'act' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="strip-col-route"]' ).should( 'have.attr', 'data-look', 'next' );
    cy.get( '[data-cy="mission-banner"]' ).should( 'contain.text', 'Waiting on you' );
    cy.get( '[data-cy="banner-cta"]' ).should( 'have.text', 'Choose' ).click();
    cy.get( '[data-cy="drawer-option"]' ).should( 'have.length', 2 ).last().should( 'contain.text', 'Roland Martin · VP Operations, Calder Systems' ).click();
    cy.wait( '@act' ).its( 'request.body' ).should( 'deep.equal', { type: 'answer', value: 'Roland Martin · VP Operations, Calder Systems' } );
  } );

  it( 'a proposed Mission starts from here', () => {
    mission( 'roland-proposed' );
    cy.intercept( 'POST', `${API}/orchestration/missions/reach-named-person/start`, ( req ) => {
      req.reply( { statusCode: 202, body: { success: true, mission: { id: 'reach-named-person', status: 'queued', steps: [], phase: 'working', plan: {}, products: [], split: {}, isOwner: true, outcomeType: 'action', origin: 'ask', title: 'Reach a named person' } } } );
    } ).as( 'start' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="mission-kicker"]' ).should( 'contain.text', 'Not started' );
    cy.get( '[data-cy="mission-banner"]' ).should( 'not.exist' );
    cy.get( '[data-cy="start"]' ).click();
    cy.wait( '@start' );
  } );
} );

describe( 'Edit plan (4a)', () => {
  beforeEach( stubApi );

  it( 'won’t save while the plan has a problem, then saves the fixed plan', () => {
    mission( 'roland-proposed' );
    let calls = 0;
    cy.intercept( 'POST', `${API}/orchestration/missions/reach-named-person/validate`, ( req ) => {
      calls += 1;
      const deleted = !req.body.steps.some( ( s: { id: string } ) => s.id === 'img' );
      req.reply( { success: true, valid: !deleted, errors: deleted ? ['Step "email" uses "$step:img" but doesn\'t come after it; add it to dependsOn.'] : [], steps: [] } );
    } ).as( 'validate' );
    cy.intercept( 'PUT', `${API}/orchestration/missions/reach-named-person/plan`, ( req ) => {
      req.reply( { success: true, mission: { id: 'reach-named-person', steps: [], status: 'proposed', phase: 'proposed', plan: {}, products: [], split: {}, isOwner: true, outcomeType: 'action', origin: 'ask', title: 'Reach a named person' } } );
    } ).as( 'save' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="edit-plan"]' ).click();
    cy.get( '[data-cy="edit-delete-img"]' ).click();
    cy.wait( '@validate' );
    cy.get( '[data-cy="edit-save"]' ).should( 'be.disabled' ).and( 'contain.text', 'Fix 1 problem to save' );
    cy.get( '[data-cy="edit-row-email"]' ).should( 'have.class', 'bad' );
    cy.get( '[data-cy="edit-put-back"]' ).click();
    cy.wait( '@validate' );
    cy.get( '[data-cy="edit-save"]' ).should( 'not.be.disabled' ).click();
    cy.wait( '@save' ).its( 'request.body.steps' ).should( 'have.length.greaterThan', 10 );
  } );

  it( 'approvals can’t go to Maya or TODD', () => {
    mission( 'roland-proposed' );
    cy.intercept( 'POST', `${API}/orchestration/missions/reach-named-person/validate`, { success: true, valid: true, errors: [], steps: [] } );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="edit-plan"]' ).click();
    cy.get( '[data-cy="edit-owner-approve"]' ).click();
    cy.get( '[data-cy="edit-owner-menu"]' ).within( () => {
      cy.get( '[data-cy="owner-option-maya"]' ).should( 'be.disabled' ).and( 'contain.text', 'Approvals need a person' );
      cy.get( '[data-cy="owner-option-todd"]' ).should( 'be.disabled' );
    } );
  } );
} );

describe( 'Report (8a), insight (7a), shortlist (11a), asset set (13a)', () => {
  beforeEach( stubApi );

  it( 'a finished Mission ends in its report', () => {
    mission( 'roland-done' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="mission-report"]' ).should( 'be.visible' );
    cy.get( '[data-cy="report-row"][data-step="approve"]' ).should( 'contain.text', 'You' );
    cy.get( '[data-cy="report-row"][data-step="follow"]' ).should( 'not.exist' );
    cy.get( '[data-cy="report-split"]' ).should( 'contain.text', 'by TODD' ).and( 'contain.text', '2 by you' ).and( 'contain.text', 'About 6 minutes of your time.' );
    cy.get( '[data-cy="mission-banner"]' ).should( 'not.exist' );
  } );

  it( 'a teammate’s silence is counted as a result', () => {
    mission( 'weekly-done', 'weekly-status' );
    cy.visitWithCypressAuth( '/missions/weekly-status', ME );
    cy.get( '[data-cy="report-row"][data-step="updates"]' ).should( 'contain.text', 'No update' );
    cy.get( '[data-cy="report-timeout"]' ).should( 'contain.text', 'Wait ended · counted as a result' );
  } );

  it( 'an insight ends with next Missions you can start', () => {
    mission( 'funded-done', 'funded-companies' );
    cy.intercept( 'POST', `${API}/orchestration/missions`, { statusCode: 202, body: { success: true, mode: 'mission', mission: { id: 'next-1', status: 'queued' } } } ).as( 'ask' );
    cy.intercept( 'GET', `${API}/orchestration/missions/next-1`, { success: true, mission: { id: 'next-1', status: 'proposed', steps: [] } } );
    cy.intercept( 'POST', `${API}/orchestration/missions/next-1/start`, { statusCode: 202, body: { success: true, mission: { id: 'next-1', status: 'queued' } } } ).as( 'start' );
    cy.visitWithCypressAuth( '/missions/funded-companies', ME );
    cy.get( '[data-cy="insight-headline"]' ).should( 'contain.text', '8 fit, 3 strong' );
    cy.get( '[data-cy="proposal"]' ).first().within( () => cy.get( '[data-cy="proposal-start"]' ).click() );
    cy.wait( '@ask' ).its( 'request.body' ).should( 'include', { origin: 'suggestion', force: 'mission' } );
    cy.wait( '@start' );
    cy.get( '[data-cy="proposal-started"]' ).should( 'contain.text', 'Started · in Moves' );
  } );

  it( 'a shortlist: keep, later, drop, then one approval starts the kept ones', () => {
    mission( 'reconnect-keep', 'reconnect-lost-touch' );
    cy.intercept( 'POST', `${API}/orchestration/missions/reconnect-lost-touch/steps/keep`, { statusCode: 202, body: { success: true } } ).as( 'answer' );
    cy.intercept( 'POST', `${API}/orchestration/missions`, { statusCode: 202, body: { success: true, mode: 'mission', mission: { id: 'kept-1', status: 'queued' } } } ).as( 'ask' );
    cy.visitWithCypressAuth( '/missions/reconnect-lost-touch', ME );
    cy.get( '[data-cy="shortlist-item"]' ).first().within( () => cy.get( '[data-cy="pick-keep"]' ).click() );
    cy.get( '[data-cy="shortlist-counter"]' ).should( 'contain.text', '1 kept' );
    cy.get( '[data-cy="start-kept"]' ).should( 'contain.text', 'Start 1 Mission' ).click();
    cy.wait( '@answer' ).its( 'request.body' ).should( 'deep.equal', { type: 'answer', value: 'Tidepool Clinics' } );
    cy.wait( '@ask' ).its( 'request.body' ).should( 'include', { origin: 'suggestion', autoStart: true } );
    cy.get( '[data-cy="batch-started"]' ).should( 'contain.text', '1 Mission started' );
  } );

  it( 'an asset set is approved as one set', () => {
    mission( 'campaign-assets', 'campaign-new-service' );
    cy.visitWithCypressAuth( '/missions/campaign-new-service', ME );
    cy.get( '[data-cy="asset-set"]' ).should( 'be.visible' );
    cy.get( '[data-cy="asset-tile"]' ).should( 'have.length.greaterThan', 1 );
    cy.get( '[data-cy="asset-approve"]' ).click();
    cy.get( '[data-cy="drawer-kicker"]' ).should( 'contain.text', 'Approval' );
  } );
} );

describe( 'Missions rows (5a) and the cockpit (9a)', () => {
  beforeEach( stubApi );

  it( 'each Move row says who holds it now', () => {
    cy.fixture( 'missions/list.json' ).then( ( list ) => cy.intercept( 'GET', `${API}/orchestration/missions?*`, list ) );
    cy.visitWithCypressAuth( '/missions', ME );
    cy.get( '[data-cy="mission-row"]' ).should( 'have.length', 5 );
    cy.get( '[data-cy="mission-row"]' ).first().find( '[data-cy="strip-now"]' ).should( 'contain.text', 'Waiting on you' );
    cy.get( '[data-cy="filter-mine"]' ).click();
    cy.get( '[data-cy="mission-row"]' ).each( ( row ) => cy.wrap( row ).find( '[data-cy="strip-now"]' ).should( 'contain.text', 'Waiting on you' ) );
  } );

  it( 'the cockpit is four dials; Stuck is green at zero', () => {
    cy.fixture( 'missions/cockpit.json' ).then( ( c ) => cy.intercept( 'GET', `${API}/orchestration/missions/cockpit`, c ) );
    cy.visitWithCypressAuth( '/missions/cockpit', ME );
    cy.get( '[data-cy="missions-cockpit"] button' ).should( 'have.length', 4 );
    cy.get( '[data-cy="dial-stuck"]' ).should( 'contain.text', '0' ).find( '.light' ).should( 'have.attr', 'style' ).and( 'contain', 'var(--green)' );
    cy.get( '[data-cy="dial-inFlight"]' ).should( 'contain.text', '12' );
    cy.get( '[data-cy="dial-waitingOnPeople"]' ).click();
    cy.location( 'pathname' ).should( 'eq', '/missions' );
  } );
} );

describe( 'Ty’s requests, each start to finish (from the real engine)', () => {
  beforeEach( stubApi );

  it( 'every one shows its plan, then its report, with nothing failed', () => {
    cy.fixture( 'missions/ty-ids.json' ).then( ( ids: string[] ) => {
      cy.fixture( 'missions/examples-proposed.json' ).then( ( proposed ) => {
        cy.fixture( 'missions/examples-done.json' ).then( ( done ) => {
          ids.forEach( ( id ) => {
            cy.intercept( 'GET', `${API}/orchestration/missions/${id}`, { success: true, mission: proposed[id] } );
            cy.visitWithCypressAuth( `/missions/${id}`, ME );
            cy.get( '[data-cy="mission-title"]' ).should( 'contain.text', proposed[id].title );
            cy.get( '[data-cy="start"]' ).should( 'be.visible' );
            cy.get( '[data-cy="plan-strip-list"] [data-look="next"]' ).should( 'have.length.greaterThan', 2 );

            cy.intercept( 'GET', `${API}/orchestration/missions/${id}`, { success: true, mission: done[id] } );
            cy.visitWithCypressAuth( `/missions/${id}`, ME );
            cy.get( '[data-cy="mission-report"]' ).should( 'be.visible' );
            cy.get( '[data-cy="report-row"]' ).should( 'have.length.greaterThan', 1 );
            cy.get( '[data-cy="plan-strip-list"] [data-look="fail"]' ).should( 'not.exist' );
            cy.get( '[data-cy="plan-strip-list"] [data-look="person"]' ).should( 'not.exist' );
          } );
        } );
      } );
    } );
  } );
} );
