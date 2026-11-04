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
    cy.get( '[data-cy="step-drawer"]' ).should( 'contain.text', 'The Marketing Assistant revises once and sends it back to you.' );
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
    cy.get( '[data-cy="who-does-it"]' ).should( 'contain.text', '16Ahead' ).and( 'contain.text', 'Marketing Assistant' ).and( 'contain.text', 'You' );
  } );

  it( 'Maya working, waiting on the world, and a failure that came to you', () => {
    mission( 'roland-maya-working' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="mission-banner"]' ).should( 'have.attr', 'data-state', 'run' ).and( 'contain.text', 'Marketing Assistant is working: design the HTML email' );

    // The fixture's wait ends on a fixed date; keep it in the future so "· N left" shows whatever day this runs.
    cy.fixture( 'missions/roland-waiting-world.json' ).then( ( m ) => {
      const waitUntil = new Date( Date.now() + 3 * 24 * 3600 * 1000 ).toISOString();
      const steps = m.steps.map( ( s: any ) => ( s.id === 'watch' ? { ...s, waitUntil } : s ) );
      cy.intercept( 'GET', `${API}/orchestration/missions/reach-named-person`, { success: true, mission: { ...m, id: 'reach-named-person', steps } } );
    } );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="mission-banner"]' ).should( 'have.attr', 'data-state', 'wait' ).and( 'contain.text', 'left' );

    mission( 'roland-failed' );
    cy.intercept( 'POST', `${API}/orchestration/missions/reach-named-person/steps/img`, { statusCode: 202, body: { success: true } } ).as( 'act' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="mission-banner"]' ).should( 'have.attr', 'data-state', 'fail' ).and( 'contain.text', 'A step failed and came to you: make a header image' );
    cy.get( '[data-cy="banner-cta"]' ).click();
    cy.get( '[data-cy="drawer-why"]' ).should( 'contain.text', 'The Marketing Assistant tried 2 times' ).and( 'contain.text', 'brand colors file' );
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

  it( 'a task takes a pasted list or an attached file (Ty, 2026-11-03)', () => {
    cy.fixture( 'missions/roland-approval.json' ).then( ( m ) => {
      const steps = m.steps.map( ( step: any ) => ( step.id === 'approve' ? { ...step, kind: 'task', title: 'Extract the firm names', why: '16Ahead can’t open that link.' } : step ) );
      cy.intercept( 'GET', `${API}/orchestration/missions/reach-named-person`, { success: true, mission: { ...m, id: 'reach-named-person', steps } } ).as( 'mission' );
    } );
    cy.intercept( 'POST', `${API}/orchestration/missions/reach-named-person/steps/approve`, { statusCode: 202, body: { success: true } } ).as( 'act' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="banner-cta"]' ).click();
    cy.get( '[data-cy="drawer-note"]' ).should( 'be.visible' ).type( 'Kapor Capital' );
    cy.get( '[data-cy="drawer-attach"] input[type=file]' ).selectFile( { contents: Cypress.Buffer.from( 'Fund,Website\nKapor Capital,kaporcapital.com' ), fileName: 'funds.csv' }, { force: true } );
    cy.get( '[data-cy="drawer-attachment"]' ).should( 'have.text', 'funds.csv' );
    cy.get( '[data-cy="drawer-done"]' ).click();
    cy.wait( '@act' ).its( 'request.body' ).should( 'deep.equal', { type: 'complete', note: 'Kapor Capital', attachment: { name: 'funds.csv', text: 'Fund,Website\nKapor Capital,kaporcapital.com' } } );
  } );

  it( 'a keep/drop pick is what you kept in the list on the page, never typed text (Ty, 2026-11-03)', () => {
    cy.fixture( 'missions/roland-approval.json' ).then( ( m ) => {
      const steps = m.steps.map( ( step: any ) => {
        if ( step.id === 'who' ) return { ...step, tool: 'todd.shortlist', output: { items: [ { id: 'kapor', name: 'Kapor Capital', why: 'Seed B2B', fit: 'strong' }, { id: 'base', name: 'Base Ventures', why: 'Fintech', fit: 'weak' } ] } };
        if ( step.id === 'pick' ) return { ...step, status: 'active', options: [], dependsOn: [ 'who' ], holder: { kind: 'you', assigneeId: 'uid-owner' } };
        if ( step.id === 'approve' ) return { ...step, status: 'pending' };
        return step;
      } );
      cy.intercept( 'GET', `${API}/orchestration/missions/reach-named-person`, { success: true, mission: { ...m, id: 'reach-named-person', steps } } ).as( 'mission' );
    } );
    cy.intercept( 'POST', `${API}/orchestration/missions/reach-named-person/steps/pick`, { statusCode: 202, body: { success: true } } ).as( 'act' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="banner-cta"]' ).click();
    cy.get( '[data-cy="drawer-shortlist"]' ).should( 'contain.text', 'None kept yet' );
    cy.get( '[data-cy="drawer-note"]' ).should( 'not.exist' );
    cy.get( '[data-cy="drawer-continue-kept"]' ).should( 'be.disabled' );
    // One place to choose: the list on the page; the drawer uses it.
    cy.get( '[data-cy="drawer-back-to-list"]' ).click();
    cy.contains( '[data-cy="shortlist-item"]', 'Kapor Capital' ).within( () => cy.get( '[data-cy="pick-keep"]' ).click() );
    cy.get( '[data-cy="banner-cta"]' ).click();
    cy.get( '[data-cy="drawer-kept-names"]' ).should( 'contain.text', 'Kapor Capital' );
    cy.get( '[data-cy="drawer-continue-kept"]' ).should( 'contain.text', 'Continue with 1 kept' ).click();
    cy.wait( '@act' ).its( 'request.body' ).should( 'deep.equal', { type: 'answer', value: 'Kapor Capital' } );
  } );

  it( 'an approval shows exactly who the send goes to', () => {
    cy.fixture( 'missions/roland-approval.json' ).then( ( m ) => {
      const steps = m.steps.map( ( step: any ) => ( step.id === 'approve' ? { ...step, recipients: [ { stepId: 'send', title: 'Send the email', count: 2, pending: false, people: [ { email: 'mitch@kaporcapital.com', name: 'Mitch Kapor', company: 'Kapor Capital' }, { email: 'henri@harlem.capital', name: '', company: '' } ] } ] } : step ) );
      cy.intercept( 'GET', `${API}/orchestration/missions/reach-named-person`, { success: true, mission: { ...m, id: 'reach-named-person', steps } } ).as( 'mission' );
    } );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="banner-cta"]' ).click();
    cy.get( '[data-cy="drawer-recipients"]' ).should( 'contain.text', 'Send the email: 2 people' ).and( 'contain.text', 'Mitch Kapor' ).and( 'contain.text', 'henri@harlem.capital' );
  } );

  it( 'an email with blanks nothing fills can’t be approved, and says what to fix (Ty, 2026-11-03)', () => {
    const check = { ok: false, documentId: 'email-1', subject: 'Quick intro: Taliferro Tech × {{companyName}}', recipients: 32, broken: false, blanks: [ { token: 'thesisKeywords', label: 'Thesis keywords' }, { token: 'scheduleUrl', label: 'Schedule url' } ], skipped: [ { token: 'companyName', label: 'Company name', count: 29, examples: [ 'charles@precursorvc.com' ] } ] };
    const load = ( c: any ) => cy.fixture( 'missions/roland-approval.json' ).then( ( m ) => {
      const steps = m.steps.map( ( step: any ) => ( step.id === 'approve' ? { ...step, emailCheck: c } : step ) );
      cy.intercept( 'GET', `${API}/orchestration/missions/reach-named-person`, { success: true, mission: { ...m, id: 'reach-named-person', steps } } ).as( 'mission' );
    } );
    load( check );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="banner-cta"]' ).click();
    cy.get( '[data-cy="drawer-email-subject"]' ).should( 'contain.text', 'Quick intro: Taliferro Tech' );
    cy.get( '[data-cy="drawer-email-check"]' ).should( 'contain.text', 'Not ready to send yet' );
    cy.get( '[data-cy="drawer-email-blanks"]' ).should( 'contain.text', '{{thesisKeywords}}' ).and( 'contain.text', '{{scheduleUrl}}' );
    cy.get( '[data-cy="drawer-email-skipped"]' ).should( 'contain.text', '29 of 32 have no company name' );
    cy.get( '[data-cy="drawer-open-docs"]' ).should( 'have.attr', 'href', 'https://docs.16ahead.com/docs/editor/email-1' );
    cy.get( '[data-cy="drawer-email-fillins"]' ).should( 'not.exist' );
    cy.get( '[data-cy="drawer-approve"]' ).should( 'be.disabled' );
  } );

  it( 'a ready email still offers to open it, and Approve is on', () => {
    cy.fixture( 'missions/roland-approval.json' ).then( ( m ) => {
      const steps = m.steps.map( ( step: any ) => ( step.id === 'approve' ? { ...step, emailCheck: { ok: true, documentId: 'email-1', subject: 'Brief intro', recipients: 32, broken: false, blanks: [], skipped: [] } } : step ) );
      cy.intercept( 'GET', `${API}/orchestration/missions/reach-named-person`, { success: true, mission: { ...m, id: 'reach-named-person', steps } } ).as( 'mission' );
    } );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="banner-cta"]' ).click();
    cy.get( '[data-cy="drawer-email-check"]' ).should( 'contain.text', 'Ready to send to 32 people' );
    cy.get( '[data-cy="drawer-open-docs"]' ).should( 'contain.text', 'Edit the email in Docs' );
    cy.get( '[data-cy="drawer-approve"]' ).should( 'not.be.disabled' );
  } );

  it( 'an approval shows the email it sends, not the list it was handed (Ty, 2026-11-03)', () => {
    cy.fixture( 'missions/roland-approval.json' ).then( ( m ) => {
      const email = m.steps.find( ( s: any ) => s.id === 'email' );
      // An attached list that finished after the email: it used to be the only thing shown.
      const list = { ...m.steps.find( ( s: any ) => s.id === 'address' ), id: 'list', title: 'Attach your list', status: 'done', branch: null, when: '', dependsOn: [], output: { documentId: 'doc-list', title: 'BlackVCCompanies.csv' } };
      const steps = [ ...m.steps.filter( ( s: any ) => s.id !== 'approve' ), list, { ...m.steps.find( ( s: any ) => s.id === 'approve' ), dependsOn: [ 'email', 'list' ] } ];
      cy.intercept( 'GET', `${API}/orchestration/missions/reach-named-person`, { success: true, mission: { ...m, id: 'reach-named-person', steps } } ).as( 'mission' );
      cy.intercept( 'GET', `${API}/docs/${email.output.documentId}`, { success: true, document: { id: email.output.documentId, htmlContent: '<p>Hello Roland, a quick intro.</p>' } } ).as( 'doc' );
      cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
      cy.get( '[data-cy="banner-cta"]' ).click();
      cy.wait( '@doc' );
      cy.get( '[data-cy="drawer-email-subject"]' ).should( 'have.text', email.output.subject );
      cy.get( '[data-cy="drawer-email-body"]' ).should( 'have.attr', 'srcdoc' ).and( 'contain', 'Hello Roland, a quick intro.' );
      cy.get( '[data-cy="drawer-email-body"]' ).should( 'have.attr', 'sandbox', '' );
      cy.get( '[data-cy="step-drawer"]' ).should( 'not.contain.text', 'BlackVCCompanies.csv' );
    } );
  } );

  it( 'a working step spins on the timeline in place of its owner, and gets its icon back when done', () => {
    cy.fixture( 'missions/roland-approval.json' ).then( ( m ) => {
      let working = true;
      cy.intercept( 'GET', `${API}/orchestration/missions/reach-named-person`, ( req ) => {
        const steps = m.steps.map( ( s: any ) => ( working && s.id === 'img' ? { ...s, status: 'active', output: null } : s ) );
        req.reply( { success: true, mission: { ...m, id: 'reach-named-person', steps, phase: working ? 'working' : m.phase } } );
      } ).as( 'mission' );
      cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
      cy.get( '[data-cy="plan-strip-list"] [data-cy="rail-spinner"]' ).should( 'have.length', 1 ).and( 'have.attr', 'aria-label', 'Marketing Assistant is working' );
      cy.get( '[data-cy="plan-strip-list"] [data-cy="step-img"]' ).should( 'have.attr', 'data-look', 'run' );
      cy.then( () => { working = false; } );
      cy.get( '[data-cy="plan-strip-list"] [data-cy="rail-spinner"]', { timeout: 10000 } ).should( 'not.exist' );
      cy.get( '[data-cy="plan-strip-list"] [data-cy="step-img"]' ).should( 'have.attr', 'data-look', 'done' );
    } );
  } );

  it( 'when your answer leads to another step for you, the drawer opens it (Ty, 2026-11-03)', () => {
    cy.fixture( 'missions/roland-approval.json' ).then( ( m ) => {
      let answered = false;
      cy.intercept( 'GET', `${API}/orchestration/missions/reach-named-person`, ( req ) => {
        const steps = m.steps.map( ( s: any ) => {
          if ( s.id === 'route' ) return answered ? { ...s, kind: 'decision', owner: 'person', holder: { owner: 'person', assigneeId: 'uid-owner' }, status: 'done' } : { ...s, kind: 'decision', owner: 'person', holder: { owner: 'person', assigneeId: 'uid-owner' }, status: 'active', options: [ 'My own list', 'Hunter' ], output: null };
          if ( s.id === 'address' ) return { ...s, title: 'Attach your list', status: answered ? 'active' : 'pending' };
          if ( s.id === 'approve' ) return { ...s, status: 'pending' };
          return s;
        } );
        req.reply( { success: true, mission: { ...m, id: 'reach-named-person', steps } } );
      } ).as( 'mission' );
      cy.intercept( 'POST', `${API}/orchestration/missions/reach-named-person/steps/route`, ( req ) => {
        answered = true;
        req.reply( { statusCode: 202, body: { success: true } } );
      } ).as( 'act' );
      cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
      cy.get( '[data-cy="banner-cta"]' ).click();
      cy.contains( '[data-cy="drawer-option"]', 'My own list' ).click();
      cy.wait( '@act' );
      cy.get( '[data-cy="step-drawer"]', { timeout: 10000 } ).should( 'be.visible' ).and( 'contain.text', 'Attach your list' );
      cy.get( '[data-cy="drawer-attach"]' ).should( 'exist' );
    } );
  } );

  it( 'the owner can cancel a Mission that hasn’t finished, after a confirm', () => {
    mission( 'roland-approval' );
    cy.intercept( 'POST', `${API}/orchestration/missions/reach-named-person/cancel`, { statusCode: 200, body: { success: true, mission: { id: 'reach-named-person', status: 'cancelled', steps: [], phase: 'cancelled', plan: {}, products: [], split: {}, isOwner: true, outcomeType: 'action', origin: 'ask', title: 'Reach a named person' } } } ).as( 'cancel' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="cancel"]' ).click();
    cy.get( '[data-cy="cancel-confirm"]' ).should( 'contain.text', 'Nothing else will run.' );
    cy.get( '[data-cy="cancel-yes"]' ).click();
    cy.wait( '@cancel' );
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
    // The report opens in a slide-out from the header (design_handoff_mission_insights_report).
    cy.get( '[data-cy="mission-state"]' ).should( 'contain.text', 'Done' ).and( 'not.contain.text', 'follow-up' ).and( 'have.attr', 'data-tone', 'done' );
    cy.get( '[data-cy="open-report"]' ).should( 'not.be.disabled' ).click();
    cy.get( '[data-cy="results-report"]' ).should( 'be.visible' );
    cy.location( 'search' ).should( 'contain', 'panel=report' );
    cy.get( '[data-cy="report-steps-toggle"]' ).click();
    cy.get( '[data-cy="report-row"][data-step="approve"]' ).should( 'contain.text', 'You' );
    cy.get( '[data-cy="report-row"][data-step="follow"]' ).should( 'not.exist' );
    cy.get( '[data-cy="report-split"]' ).should( 'contain.text', 'by 16Ahead' ).and( 'contain.text', '2 by you' ).and( 'contain.text', 'About 6 minutes of your time.' );
    cy.get( 'body' ).type( '{esc}' );
    cy.get( '[data-cy="results-panel"]' ).should( 'not.exist' );
    cy.get( '[data-cy="mission-banner"]' ).should( 'not.exist' );
  } );

  it( 'insights: a short headline, numbered findings with people and a next step, evidence on request; a link opens the tab', () => {
    cy.fixture( 'missions/roland-done.json' ).then( ( m ) => {
      const insights = { headline: 'Three contacts opened your emails. Nobody has replied yet.', summary: 'Lindsey at Nation LTD is the most engaged.', findings: [
        { id: 'f1', title: '3 contacts opened your emails', body: 'Lindsey and Joe at Nation LTD, and Justin at Visible Hands VC, opened at least one email.', contacts: [ { name: 'Lindsey', firm: 'Nation LTD', email: 'lindsey@nationltd.com' } ], nextAction: 'Send Lindsey a short follow-up', evidence: 'lindsey@nationltd.com opened=true 2026-09-24' },
      ] };
      cy.intercept( 'GET', `${API}/orchestration/missions/reach-named-person`, { success: true, mission: { ...m, report: { ...m.report, insights, outcome: '2 emails sent, 1 opened, 0 replied.', stats: [ { value: 2, label: 'Emails sent' }, { value: 0, label: 'Replied', tone: 'muted' } ], next: [ 'Send Lindsey a short follow-up' ] } } } ).as( 'mission' );
    } );
    cy.visitWithCypressAuth( '/missions/reach-named-person?panel=insights', ME );
    cy.get( '[data-cy="results-insights"]' ).should( 'be.visible' );
    cy.get( '[data-cy="insights-headline"]' ).should( 'contain.text', 'Nobody has replied yet' );
    cy.get( '[data-cy="insights-finding"]' ).should( 'have.length', 1 ).first().should( 'contain.text', '01' ).and( 'contain.text', 'Lindsey' ).and( 'contain.text', 'Send Lindsey a short follow-up' );
    cy.get( '[data-cy="insights-evidence"]' ).should( 'not.exist' );
    cy.get( '[data-cy="insights-evidence-toggle"]' ).click();
    cy.get( '[data-cy="insights-evidence"]' ).should( 'contain.text', 'opened=true' );
    cy.get( '[data-cy="results-tab-report"]' ).click();
    cy.get( '[data-cy="report-outcome"]' ).should( 'contain.text', '2 emails sent' );
    cy.get( '[data-cy="report-stats"]' ).should( 'contain.text', 'Emails sent' );
    cy.get( '[data-cy="report-next"]' ).should( 'contain.text', 'Send Lindsey a short follow-up' );
    cy.get( '[data-cy="results-close"]' ).click();
    cy.get( '[data-cy="open-report"]' ).should( 'have.focus' );
    cy.get( '[data-cy="open-insights"]' ).should( 'contain.text', '1' );
    cy.location( 'search' ).should( 'not.contain', 'panel=' );
  } );

  it( 'while it runs, Insights and Report wait for the finish', () => {
    mission( 'roland-waiting-world' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="mission-state"]' ).should( 'contain.text', 'Waiting' ).and( 'have.attr', 'data-tone', 'waiting' );
    cy.get( '[data-cy="open-insights"]' ).should( 'be.disabled' );
    cy.get( '[data-cy="open-report"]' ).should( 'be.disabled' );
    cy.get( '[data-cy="results-row"]' ).should( 'contain.text', 'Available when the mission finishes' );
  } );

  it( 'the header says what a Mission needs: you, or the follow-ups it handed you once done (Ty, 2026-11-03)', () => {
    mission( 'roland-approval' );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="mission-state"]' ).should( 'contain.text', 'Needs you' ).and( 'have.attr', 'data-tone', 'you' );
    cy.fixture( 'missions/roland-done.json' ).then( ( m ) => {
      const followUps = [
        { id: 't2', title: 'Prep for Kapor', assigneeId: 'uid-owner', dueDate: '2026-11-10', done: false },
        { id: 't1', title: 'Call Lindsey', assigneeId: 'uid-owner', dueDate: '', done: true },
      ];
      cy.intercept( 'GET', `${API}/orchestration/missions/reach-named-person`, { success: true, mission: { ...m, followUps } } ).as( 'mission' );
    } );
    cy.visitWithCypressAuth( '/missions/reach-named-person', ME );
    cy.get( '[data-cy="mission-state"]' ).should( 'contain.text', 'Done · 1 follow-up for you' ).and( 'have.attr', 'data-tone', 'you' );
    cy.get( '[data-cy="follow-up"]' ).should( 'have.length', 2 );
    cy.get( '[data-cy="follow-up"]' ).first().should( 'contain.text', 'Prep for Kapor' ).and( 'contain.text', 'due Nov' ).and( 'have.attr', 'href', 'https://moves.16ahead.com/app?move=t2' );
    cy.get( '[data-cy="follow-up"]' ).last().should( 'have.class', 'done' ).and( 'contain.text', 'You · done' );
  } );

  it( 'a teammate’s silence is counted as a result', () => {
    mission( 'weekly-done', 'weekly-status' );
    cy.visitWithCypressAuth( '/missions/weekly-status', ME );
    cy.get( '[data-cy="open-report"]' ).click();
    cy.get( '[data-cy="report-steps-toggle"]' ).click();
    cy.get( '[data-cy="report-row"][data-step="updates"]' ).should( 'contain.text', 'No update' );
    cy.get( '[data-cy="report-timeout"]' ).should( 'contain.text', 'Wait ended · counted as a result' );
  } );

  it( 'an insight ends with next Missions you can start', () => {
    mission( 'funded-done', 'funded-companies' );
    cy.intercept( 'POST', `${API}/orchestration/missions`, { statusCode: 202, body: { success: true, mode: 'mission', mission: { id: 'next-1', status: 'queued' } } } ).as( 'ask' );
    cy.intercept( 'GET', `${API}/orchestration/missions/next-1`, { success: true, mission: { id: 'next-1', status: 'proposed', steps: [] } } );
    cy.intercept( 'POST', `${API}/orchestration/missions/next-1/start`, { statusCode: 202, body: { success: true, mission: { id: 'next-1', status: 'queued' } } } ).as( 'start' );
    cy.visitWithCypressAuth( '/missions/funded-companies', ME );
    cy.get( '[data-cy="open-report"]' ).click();
    cy.get( '[data-cy="report-outcome"]' ).should( 'contain.text', '8 fit, 3 strong' );
    cy.get( '[data-cy="results-close"]' ).click();
    cy.get( '[data-cy="proposal"]' ).first().within( () => cy.get( '[data-cy="proposal-start"]' ).click() );
    cy.wait( '@ask' ).its( 'request.body' ).should( 'include', { origin: 'suggestion', force: 'mission' } );
    cy.wait( '@start' );
    cy.get( '[data-cy="proposal-started"]' ).should( 'contain.text', 'Started · in Moves' );
  } );

  it( 'a shortlist the plan ends on: keep, later, drop, then each kept one becomes its own Mission', () => {
    mission( 'map-pick', 'map-account' );
    cy.intercept( 'POST', `${API}/orchestration/missions/map-account/steps/pick`, { statusCode: 202, body: { success: true } } ).as( 'answer' );
    cy.intercept( 'POST', `${API}/orchestration/missions`, { statusCode: 202, body: { success: true, mode: 'mission', mission: { id: 'kept-1', status: 'queued' } } } ).as( 'ask' );
    cy.visitWithCypressAuth( '/missions/map-account', ME );
    cy.get( '[data-cy="shortlist-item"]' ).first().within( () => cy.get( '[data-cy="pick-keep"]' ).click() );
    cy.get( '[data-cy="shortlist-counter"]' ).should( 'contain.text', '1 kept' );
    cy.get( '[data-cy="start-kept"]' ).should( 'contain.text', 'Start 1 Mission' ).click();
    cy.wait( '@answer' ).its( 'request.body' ).should( 'deep.equal', { type: 'answer', value: 'Tidepool Clinics' } );
    cy.wait( '@ask' ).its( 'request.body' ).should( 'include', { origin: 'suggestion', autoStart: true } );
    cy.get( '[data-cy="batch-started"]' ).should( 'contain.text', '1 Mission started' );
  } );

  it( 'a shortlist the plan continues from: the kept ones go on in this Mission, no extra Missions', () => {
    mission( 'reconnect-keep', 'reconnect-lost-touch' );
    cy.intercept( 'POST', `${API}/orchestration/missions/reconnect-lost-touch/steps/keep`, { statusCode: 202, body: { success: true } } ).as( 'answer' );
    cy.intercept( 'POST', `${API}/orchestration/missions`, cy.spy().as( 'ask' ) );
    cy.visitWithCypressAuth( '/missions/reconnect-lost-touch', ME );
    cy.get( '[data-cy="shortlist-item"]' ).first().within( () => cy.get( '[data-cy="pick-keep"]' ).click() );
    cy.get( '[data-cy="start-kept"]' ).should( 'not.exist' );
    cy.get( '[data-cy="continue-kept"]' ).should( 'contain.text', 'Continue with 1 kept' ).click();
    cy.wait( '@answer' ).its( 'request.body' ).should( 'deep.equal', { type: 'answer', value: 'Tidepool Clinics' } );
    cy.get( '[data-cy="batch-started"]' ).should( 'contain.text', '1 kept · the Mission carries on' );
    cy.get( '@ask' ).should( 'not.have.been.called' );
  } );

  it( 'an industry segment: keep the right firms, and the batch email goes on from here', () => {
    mission( 'segment-keep', 'pitch-segment' );
    cy.intercept( 'POST', `${API}/orchestration/missions/pitch-segment/steps/keep`, { statusCode: 202, body: { success: true } } ).as( 'answer' );
    cy.intercept( 'POST', `${API}/orchestration/missions`, cy.spy().as( 'ask' ) );
    cy.visitWithCypressAuth( '/missions/pitch-segment', ME );
    cy.get( '[data-cy="mission-title"]' ).should( 'contain.text', 'Email an industry segment' );
    cy.get( '[data-cy="shortlist"]' ).should( 'contain.text', '3 firms invest at your stage' )
      .and( 'contain.text', 'carries on with them: unlock emails for the Lead Vault people you kept' );
    cy.get( '[data-cy="shortlist-item"]' ).should( 'have.length', 3 );
    cy.get( '[data-cy="shortlist-item"]' ).eq( 0 ).should( 'contain.text', 'Northline Ventures' ).and( 'contain.text', 'Strong' ).within( () => cy.get( '[data-cy="pick-keep"]' ).click() );
    cy.get( '[data-cy="shortlist-item"]' ).eq( 1 ).within( () => cy.get( '[data-cy="pick-keep"]' ).click() );
    cy.get( '[data-cy="shortlist-item"]' ).eq( 2 ).within( () => cy.get( '[data-cy="pick-drop"]' ).click() );
    cy.get( '[data-cy="shortlist-counter"]' ).should( 'contain.text', '2 kept' ).and( 'contain.text', '1 dropped' );
    cy.get( '[data-cy="continue-kept"]' ).click();
    cy.wait( '@answer' ).its( 'request.body' ).should( 'deep.equal', { type: 'answer', value: 'Northline Ventures, Grant & Co' } );
    cy.get( '@ask' ).should( 'not.have.been.called' );
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
            cy.get( '[data-cy="open-report"]' ).click();
            cy.get( '[data-cy="report-steps-toggle"]' ).click();
            cy.get( '[data-cy="report-row"]' ).should( 'have.length.greaterThan', 1 );
            cy.get( '[data-cy="results-close"]' ).click();
            cy.get( '[data-cy="plan-strip-list"] [data-look="fail"]' ).should( 'not.exist' );
            cy.get( '[data-cy="plan-strip-list"] [data-look="person"]' ).should( 'not.exist' );
          } );
        } );
      } );
    } );
  } );
} );
