describe( 'AI Missions (/ai-missions, /move/:id/mission)', () => {
  const signedInUser = {
    uid: 'ai-missions-user',
    tenantId: 'ai-missions-tenant',
    email: 'ai-missions@example.com',
    paid: true
  };

  function makeMission ( overrides: Record<string, unknown> = {} ) {
    return {
      id: 'mission-1',
      tenantId: signedInUser.tenantId,
      createdBy: signedInUser.uid,
      title: 'Draft the Q3 investor update',
      objective: 'Summarize progress and asks for the board.',
      successCriteria: 'Board has a clear read on runway and next hires.',
      missionContext: {},
      priority: 'high',
      status: 'active',
      missionPlan: [
        { id: 'step-1', stepNumber: 1, description: 'Pull the latest metrics', capability: 'research', requiresApproval: false, status: 'completed' },
        { id: 'step-2', stepNumber: 2, description: 'Draft the update', capability: 'writing', requiresApproval: false, status: 'in_progress' }
      ],
      currentStepIndex: 1,
      researchNotes: [],
      artifacts: [],
      nextAction: 'Draft the update',
      escalationReason: '',
      approvalRequired: false,
      pendingApprovalAction: null,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
      ...overrides
    };
  }

  it( 'renders the mission list, shows the approval banner, and filters by status', () => {
    const missions = [
      makeMission( { id: 'mission-active', title: 'Draft the Q3 investor update', status: 'active' } ),
      makeMission( {
        id: 'mission-approval',
        title: 'Send the pricing change email',
        status: 'needs_approval',
        pendingApprovalAction: {
          stepId: 'step-1',
          capability: 'email',
          summary: 'TODD wants to send the pricing change email to all customers.',
          data: {},
          requestedAt: '2026-04-02T00:00:00.000Z'
        }
      } )
    ];

    cy.intercept( 'GET', '**/api/ai-missions*', ( req ) => {
      const status = req.query['status'];
      const body = status
        ? { success: true, missions: missions.filter( m => m.status === status ) }
        : { success: true, missions };
      req.reply( { statusCode: 200, body } );
    } ).as( 'listMissions' );

    cy.visitWithCypressAuth( '/ai-missions', signedInUser );
    cy.wait( '@listMissions' );

    cy.contains( '.page-title', 'AI Missions' ).should( 'be.visible' );
    cy.contains( '.mission-card', 'Draft the Q3 investor update' ).should( 'be.visible' );
    cy.contains( '.mission-card', 'Send the pricing change email' ).should( 'be.visible' );

    cy.contains( '.approval-alert', 'TODD needs your approval on 1 mission.' ).should( 'be.visible' );
    cy.contains( '.approval-alert button', 'View them' ).click();
    cy.wait( '@listMissions' );

    cy.get( '.filter-tab.active' ).should( 'contain', 'Needs Approval' );
    cy.contains( '.mission-card', 'Send the pricing change email' ).should( 'be.visible' );
    cy.contains( '.mission-card', 'Draft the Q3 investor update' ).should( 'not.exist' );
  } );

  it( 'shows the empty state when there are no missions for the selected filter', () => {
    cy.intercept( 'GET', '**/api/ai-missions*', {
      statusCode: 200,
      body: { success: true, missions: [] }
    } ).as( 'listMissions' );

    cy.visitWithCypressAuth( '/ai-missions', signedInUser );
    cy.wait( '@listMissions' );

    cy.contains( 'No missions found for this filter.' ).should( 'be.visible' );
    cy.contains( 'button', 'Create your first AI Mission' ).should( 'be.visible' );
  } );

  it( '"+ New AI Mission" routes into the move form in AI-mission mode', () => {
    cy.intercept( 'GET', '**/api/ai-missions*', { statusCode: 200, body: { success: true, missions: [] } } );

    cy.visitWithCypressAuth( '/ai-missions', signedInUser );
    cy.contains( 'button', '+ New AI Mission' ).click();

    cy.location( 'pathname' ).should( 'eq', '/move' );
    cy.location( 'search' ).should( 'include', 'assignToTodd=true' );
    // task-edit.component.ts sets isAIMission from the assignToTodd param,
    // which swaps the header from "Create Move" to "New AI Mission" - see
    // the fix earlier this session.
    cy.contains( 'h1', 'New AI Mission' ).should( 'be.visible' );
    cy.get( '[data-cy="moves-ai-objective"]' ).should( 'be.visible' );
  } );

  it( 'opens a mission from the list and shows its plan, activity log, and Run Mission control', () => {
    const mission = makeMission();
    const activityLog = [
      { id: 'log-1', missionId: mission.id, tenantId: signedInUser.tenantId, actor: 'todd', actionType: 'step_completed', summary: 'Pulled the latest metrics.', createdAt: '2026-04-02T00:00:00.000Z' }
    ];

    cy.intercept( 'GET', '**/api/ai-missions*', { statusCode: 200, body: { success: true, missions: [mission] } } ).as( 'listMissions' );
    cy.intercept( 'GET', `**/ai-missions/${mission.id}`, { statusCode: 200, body: { success: true, mission } } ).as( 'getMission' );
    cy.intercept( 'GET', `**/ai-missions/${mission.id}/activity*`, { statusCode: 200, body: { success: true, log: activityLog } } ).as( 'getActivity' );

    cy.visitWithCypressAuth( '/ai-missions', signedInUser );
    cy.wait( '@listMissions' );
    cy.contains( '.mission-card', mission.title ).find( 'button' ).contains( 'View Mission' ).click();

    cy.location( 'pathname' ).should( 'eq', `/move/${mission.id}/mission` );
    cy.wait( '@getMission' );
    cy.wait( '@getActivity' );

    cy.contains( '.mission-title', mission.title ).should( 'be.visible' );
    cy.contains( '.section-title', 'Mission Plan' ).should( 'be.visible' );
    cy.contains( '.step-desc', 'Pull the latest metrics' ).should( 'be.visible' );
    cy.contains( '.entry-summary', 'Pulled the latest metrics.' ).should( 'be.visible' );
    cy.get( '.btn-run' ).should( 'be.visible' ).and( 'contain', 'Run Mission Now' );
  } );

  it( 'runs an active mission and reflects the mission moving to needs_approval', () => {
    const mission = makeMission( { status: 'active' } );
    const afterRun = makeMission( {
      status: 'needs_approval',
      nextAction: 'Send the update for review',
      pendingApprovalAction: {
        stepId: 'step-2',
        capability: 'writing',
        summary: 'TODD drafted the update and wants your approval before sending.',
        data: {},
        requestedAt: '2026-04-02T01:00:00.000Z'
      }
    } );

    cy.intercept( 'GET', `**/ai-missions/${mission.id}`, { statusCode: 200, body: { success: true, mission } } ).as( 'getMission' );
    cy.intercept( 'GET', `**/ai-missions/${mission.id}/activity*`, { statusCode: 200, body: { success: true, log: [] } } ).as( 'getActivity' );
    cy.intercept( 'POST', `**/ai-missions/${mission.id}/run`, {
      statusCode: 200,
      body: { success: true, result: { status: 'needs_approval' } }
    } ).as( 'runMission' );

    cy.visitWithCypressAuth( `/move/${mission.id}/mission`, signedInUser );
    cy.wait( '@getMission' );
    cy.wait( '@getActivity' );

    // Re-stub the GET after the initial load so the post-run refetch sees
    // the updated mission instead of the same active one.
    cy.intercept( 'GET', `**/ai-missions/${mission.id}`, { statusCode: 200, body: { success: true, mission: afterRun } } ).as( 'getMissionAfterRun' );

    cy.get( '.btn-run' ).click();
    cy.wait( '@runMission' );
    cy.wait( '@getMissionAfterRun' );

    cy.contains( '.status-text', 'Needs Approval' ).should( 'be.visible' );
    cy.contains( '.approval-panel', 'TODD needs your approval' ).should( 'be.visible' );
    cy.get( '.btn-run' ).should( 'not.exist' );
  } );

  it( 'approves a pending mission action from the detail page', () => {
    const mission = makeMission( {
      status: 'needs_approval',
      pendingApprovalAction: {
        stepId: 'step-2',
        capability: 'writing',
        summary: 'TODD drafted the update and wants your approval before sending.',
        data: {},
        requestedAt: '2026-04-02T01:00:00.000Z'
      }
    } );
    const approvedMission = { ...mission, status: 'active', pendingApprovalAction: null };

    cy.intercept( 'GET', `**/ai-missions/${mission.id}`, { statusCode: 200, body: { success: true, mission } } ).as( 'getMission' );
    cy.intercept( 'GET', `**/ai-missions/${mission.id}/activity*`, { statusCode: 200, body: { success: true, log: [] } } ).as( 'getActivity' );
    cy.intercept( 'POST', `**/ai-missions/${mission.id}/approve`, ( req ) => {
      expect( req.body.decision ).to.equal( 'approve' );
      req.reply( { statusCode: 200, body: { success: true, mission: approvedMission } } );
    } ).as( 'approveMission' );

    cy.visitWithCypressAuth( `/move/${mission.id}/mission`, signedInUser );
    cy.wait( '@getMission' );
    cy.wait( '@getActivity' );

    cy.contains( '.approval-panel', 'TODD needs your approval' ).should( 'be.visible' );
    cy.contains( '.approval-panel button', 'Approve' ).click();
    cy.wait( '@approveMission' );

    cy.contains( '.approval-feedback.success', 'Approved. TODD is continuing the mission.' ).should( 'be.visible' );
    cy.contains( '.status-text', 'Active' ).should( 'be.visible' );
  } );
} );
