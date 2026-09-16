describe( 'Mission Workspace (/plan)', () => {
  const signedInUser = {
    uid: 'mission-workspace-user',
    tenantId: 'mission-workspace-tenant',
    email: 'mission-workspace@example.com',
    paid: true
  };

  it( 'lets a guest preview and approve a demo mission end to end, including the communication composer', () => {
    // Demo mode (?demo=1) pre-fills the form and the plan preview on load -
    // see activateMissionDemoMode() in ngOnInit - nothing to click to see
    // the first preview.
    cy.visit( '/plan?demo=1' );

    cy.contains( 'DEMO MODE' ).should( 'be.visible' );
    cy.contains( '[data-cy="moves-guest-sign-in"]', 'Sign in to try it with your data' ).should( 'be.visible' );

    cy.get( '[data-cy="moves-plan-title"]' ).should( 'have.value', 'Launch the next delivery milestone' );
    cy.contains( '#mission-plan', 'Launch the next delivery milestone' ).should( 'exist' );
    cy.contains( '.mission-status-pill', 'Plan preview' ).should( 'exist' );

    cy.get( '[data-cy="moves-plan-approve"]' ).contains( 'Approve and Create Moves' ).click();

    cy.contains( '.mission-status-pill', 'Live mission' ).should( 'exist' );
    cy.contains( '.mission-helper-card', 'Moves created' ).should( 'exist' );
    cy.contains( '#mission-moves', 'Mission Moves' ).should( 'be.visible' );
    cy.get( '#mission-moves' ).contains( 'Clarify the mission brief' ).should( 'exist' );

    // Communication drafts carry over from the approved demo mission.
    cy.contains( '.mission-section-label', 'Mission communication drafts' ).should( 'be.visible' );
    cy.contains( '.mission-draft-card', 'Stakeholder status update' )
      .find( 'button' ).contains( 'Open in Mission Composer' ).click();

    cy.contains( '.mission-section-label', 'Mission Update Composer' ).should( 'be.visible' );
    cy.get( '[name="missionComposerTitle"]' ).should( 'have.value', 'Launch the next delivery milestone: Stakeholder status update' );
    cy.get( '[name="missionComposerBody"]' ).should( 'not.have.value', '' );

    cy.contains( 'button', 'Close without sending' ).click();
    cy.contains( '.mission-section-label', 'Mission Update Composer' ).should( 'not.exist' );
  } );

  it( 'shows a validation error when required mission fields are missing', () => {
    cy.visit( '/plan' );
    cy.get( '[data-cy="moves-plan-generate"]' ).click();
    cy.contains( 'Fill in the required mission details before TODD can generate the plan.' ).should( 'be.visible' );
    cy.get( '#mission-plan' ).should( 'not.exist' );
  } );

  it( 'lets a signed-in user generate a real plan, approve it, and see it in the recent missions list', () => {
    const previewData = {
      id: '',
      missionType: 'project_delivery_outcome',
      status: 'planned',
      title: 'Ship the Q3 onboarding revamp',
      intake: {
        title: 'Ship the Q3 onboarding revamp',
        missionType: 'project_delivery_outcome',
        problemStatement: 'New users drop off before finishing setup.',
        desiredOutcome: 'A shorter, clearer onboarding flow shipped this quarter.'
      },
      plan: {
        projectSummary: 'Redesign onboarding to cut drop-off.',
        successCriteria: ['Setup completion rate above 80%'],
        milestones: [],
        taskPlan: [
          { title: 'Audit current onboarding funnel', description: 'Find the drop-off point.', phase: 'discover', priority: 'high' }
        ],
        nextRecommendedMove: { label: 'Audit current onboarding funnel', description: 'Find the drop-off point.' }
      },
      moves: [],
      progress: { totalCount: 1, openCount: 1, completedCount: 0 },
      risks: []
    };

    const createdMission = {
      ...previewData,
      id: 'mission-real-1',
      status: 'active',
      moveCount: 1,
      moves: [{ id: 'move-from-mission-1', title: 'Audit current onboarding funnel', status: 'not-started', priority: 'high' }],
      progress: { totalCount: 1, openCount: 1, completedCount: 0 }
    };

    cy.intercept( 'POST', '**/missions/plan', {
      statusCode: 200,
      body: { success: true, data: previewData }
    } ).as( 'previewPlan' );

    cy.intercept( 'POST', '**/missions', ( req ) => {
      expect( req.body.problemStatement ).to.equal( 'New users drop off before finishing setup.' );
      req.reply( { statusCode: 200, body: { success: true, data: createdMission } } );
    } ).as( 'createMission' );

    cy.intercept( 'GET', '**/missions', {
      statusCode: 200,
      body: { success: true, data: [createdMission] }
    } ).as( 'listMissions' );

    // approveAndCreateMoves() syncs ?missionId= into the URL on success,
    // which re-fires the queryParamMap subscription and reloads the
    // mission - intercept that too so the test doesn't leave an unmocked
    // request in flight.
    cy.intercept( 'GET', '**/missions/mission-real-1', {
      statusCode: 200,
      body: { success: true, data: createdMission }
    } ).as( 'reloadMission' );

    cy.visitWithCypressAuth( '/plan', signedInUser );
    cy.wait( '@listMissions' );

    cy.get( '[data-cy="moves-plan-problem-statement"]' ).type( 'New users drop off before finishing setup.' );
    cy.get( '[data-cy="moves-plan-desired-outcome"]' ).type( 'A shorter, clearer onboarding flow shipped this quarter.' );
    cy.get( '[data-cy="moves-plan-resources"]' ).type( 'Design lead\nOnboarding PM' );
    cy.get( '[data-cy="moves-plan-generate"]' ).click();

    cy.wait( '@previewPlan' );
    cy.contains( '#mission-plan', 'Ship the Q3 onboarding revamp' ).should( 'exist' );
    cy.contains( '.mission-status-pill', 'Plan preview' ).should( 'exist' );

    cy.get( '[data-cy="moves-plan-approve"]' ).contains( 'Approve and Create Moves' ).click();
    cy.wait( '@createMission' );

    cy.contains( '.mission-status-pill', 'Live mission' ).should( 'exist' );
    cy.contains( '.mission-helper-card', 'Moves created' ).should( 'exist' );
    cy.location( 'search' ).should( 'include', 'missionId=mission-real-1' );
  } );

  it( 'lets a signed-in user reopen a recent mission and review a plan revision', () => {
    const existingMission = {
      id: 'mission-revise-1',
      missionType: 'project_delivery_outcome',
      status: 'active',
      title: 'Fix the checkout drop-off',
      moveCount: 2,
      intake: {
        title: 'Fix the checkout drop-off',
        missionType: 'project_delivery_outcome',
        problemStatement: 'Checkout abandonment is up this month.',
        desiredOutcome: 'Checkout completion back above baseline.'
      },
      plan: { projectSummary: 'Stabilize checkout.', successCriteria: [], milestones: [], taskPlan: [] },
      moves: [
        { id: 'move-checkout-1', title: 'Audit checkout errors', status: 'in-progress', priority: 'high' }
      ],
      progress: { totalCount: 2, openCount: 2, completedCount: 0 }
    };

    const revisedPreview = {
      ...existingMission,
      revision: {
        unchangedTaskCount: 1,
        newTaskCount: 1,
        changedTaskCount: 0,
        removedTaskCount: 0,
        taskChanges: {
          unchanged: [{ title: 'Audit checkout errors', description: '', phase: '', priority: 'high' }],
          added: [{ title: 'Add checkout error monitoring', description: 'Catch failures before support tickets do.', phase: 'stabilize', priority: 'high' }],
          modified: [],
          removed: []
        }
      }
    };

    // ngOnInit() always calls loadRecentMissions() on a non-demo load,
    // regardless of whether ?missionId= is also present.
    cy.intercept( 'GET', '**/missions', {
      statusCode: 200,
      body: { success: true, data: [] }
    } ).as( 'listMissions' );

    cy.intercept( 'GET', '**/missions/mission-revise-1', {
      statusCode: 200,
      body: { success: true, data: existingMission }
    } ).as( 'getMission' );

    cy.intercept( 'POST', '**/missions/mission-revise-1/revision-preview', {
      statusCode: 200,
      body: { success: true, data: revisedPreview }
    } ).as( 'previewRevision' );

    cy.intercept( 'POST', '**/missions/mission-revise-1/revisions/apply', ( req ) => {
      expect( req.body.applyNetNewMoves ).to.equal( true );
      req.reply( {
        statusCode: 200,
        body: {
          success: true,
          data: {
            ...existingMission,
            latestRevision: { createdAt: new Date().toISOString(), newTaskCount: 1, changedTaskCount: 0, removedTaskCount: 0 }
          }
        }
      } );
    } ).as( 'applyRevision' );

    cy.visitWithCypressAuth( '/plan?missionId=mission-revise-1', signedInUser );
    cy.wait( '@getMission' );

    cy.contains( '#mission-plan', 'Fix the checkout drop-off' ).should( 'exist' );
    cy.contains( 'button', 'Regenerate Plan From Current Mission' ).click();
    cy.wait( '@previewRevision' );

    cy.contains( '.mission-section-label', 'Revision review' ).should( 'be.visible' );
    cy.contains( '.mission-revision-kpi', 'New tasks' ).should( 'contain', '1' );
    cy.contains( '.mission-revision-card', 'New tasks TODD recommends' )
      .should( 'contain', 'Add checkout error monitoring' );

    cy.get( '[data-cy="moves-plan-approve"]' ).contains( 'Apply revised plan' ).click();
    cy.wait( '@applyRevision' );

    cy.contains( '.mission-helper-card', 'Revision applied' ).should( 'exist' );
  } );
} );
