/**
 * The Moves assistant and Missions (2026-10-22, the shared piece in
 * taliferro-ui/missions/assistant-missions, same as Outreach and Network):
 * the assistant opens large and centered, and real work becomes a Mission
 * shown right in the conversation, where the person finishes the steps that
 * need them. Fixtures come from todd-backend scripts/missions-fixtures.js.
 */
const ME = { uid: 'uid-owner', tenantId: 'tenant-1', paid: true };
const API = 'https://api.taliferro.tech/api';

describe( 'Moves assistant: Missions', () => {
  beforeEach( () => {
    // Nothing in these specs may reach the real API.
    cy.intercept( { url: `${API}/**` }, { statusCode: 200, body: {} } );
  } );

  const openAssistant = () => {
    cy.visitWithCypressAuth( '/', ME );
    cy.get( '.talk-to-todd-glass' ).click( { force: true } );
    cy.get( '.todd-assistant-window-open' ).should( 'be.visible' );
    cy.get( '.talk-to-todd-glass' ).should( 'have.class', 'talk-to-todd-glass-hidden' );
  };

  const ask = ( text: string ) => {
    cy.get( '.todd-assistant-window-open .ios-input' ).type( text );
    cy.get( '.todd-assistant-window-open .assistant-bar .btn-todd' ).first().click();
  };

  const missionAt = ( fixture: string, id: string ) => {
    cy.fixture( `missions/${fixture}.json` ).then( ( m ) => {
      cy.intercept( 'POST', `${API}/orchestration/missions`, { statusCode: 202, body: { success: true, mode: 'mission', mission: { ...m, id, status: 'queued', steps: [] } } } ).as( 'ask' );
      cy.intercept( 'GET', `${API}/orchestration/missions/${id}`, { success: true, mission: { ...m, id } } );
    } );
  };

  it( 'opens centered, at 80% of the screen, above everything', () => {
    openAssistant();
    cy.window().then( ( win ) => {
      cy.get( '.todd-assistant-window-open' ).should( ( $el ) => {
        const el = $el[0] as HTMLElement;
        expect( el.offsetWidth ).to.be.closeTo( win.innerWidth * 0.8, 2 );
        expect( el.offsetHeight ).to.be.closeTo( win.innerHeight * 0.8, 2 );
        const box = el.getBoundingClientRect();
        expect( win.document.elementFromPoint( box.left + 20, box.top + box.height / 2 ) ).to.satisfy( ( hit: Element ) => el.contains( hit ) );
      } );
    } );
    cy.get( '.todd-assistant-scrim' ).click( { force: true } );
    cy.get( '.todd-assistant-window-open' ).should( 'not.exist' );
  } );

  it( 'emailing investors becomes a Mission in the conversation', () => {
    missionAt( 'segment-proposed', 'pitch-segment' );
    openAssistant();
    ask( 'I would like to send an email to investors about our TODD product' );
    cy.wait( '@ask' ).its( 'request.body.context' ).should( 'include', { app: 'moves' } );
    cy.get( '[data-cy="assistant-mission"]' ).should( 'exist' ).within( () => {
      cy.get( '[data-cy="mission-title"]' ).should( 'be.visible' ).and( 'contain.text', 'Email an industry segment' );
      cy.get( '[data-cy="start"]' ).should( 'be.visible' );
    } );
  } );

  it( 'a step that needs you (the send) is finished right here', () => {
    missionAt( 'roland-send-handed', 'reach-named-person' );
    cy.intercept( 'POST', `${API}/orchestration/missions/reach-named-person/steps/send`, { statusCode: 202, body: { success: true } } ).as( 'done' );
    openAssistant();
    ask( 'Email Roland Martin' );
    cy.get( '[data-cy="assistant-mission"] [data-cy="mission-banner"]' ).should( 'contain.text', 'Waiting on you: send it' );
    cy.get( '[data-cy="assistant-mission"] [data-cy="banner-cta"]' ).click();
    cy.get( '[data-cy="drawer-done"]' ).click();
    cy.wait( '@done' ).its( 'request.body.type' ).should( 'eq', 'complete' );
  } );
} );
