describe( 'Moves automation workflows', () => {
  const signedInUser = {
    uid: 'moves-automation-user',
    tenantId: 'moves-automation-tenant',
    email: 'moves-automation@example.com',
    paid: true
  };

  it( 'lets a user review and approve schedule automation changes', () => {
    const tasks = [
      {
        id: 'move-schedule-1',
        title: 'Overdue follow-up',
        description: 'This move should trigger a schedule fix.',
        dueDate: '2026-03-28T00:00:00.000Z',
        progress: 15,
        status: 'todo',
        priority: 'high',
        isCompleted: false,
        needsAttention: true,
        contactIds: [],
        contacts: [],
        documents: [],
        images: [],
        subTasks: [],
        projectId: '',
        taskTypeId: ''
      }
    ];

    cy.intercept( 'GET', '**/moves', {
      statusCode: 200,
      body: { tasks }
    } ).as( 'loadMoves' );

    cy.intercept( 'PUT', '**/moves/move-schedule-1', ( req ) => {
      req.reply( {
        statusCode: 200,
        body: {
          task: {
            ...tasks[0],
            ...req.body
          }
        }
      } );
    } ).as( 'applySchedulePatch' );

    cy.visitWithCypressAuth( '/moves-view', signedInUser, {
      onBeforeLoad: ( win ) => {
        win.localStorage.removeItem( 'moves-automation-settings' );
        win.localStorage.removeItem( 'moves-automation-history' );
      }
    } );

    cy.wait( '@loadMoves' );
    cy.get( '[data-cy="moves-automation-action-schedule"]' ).should( 'not.be.disabled' ).click();
    cy.get( '[data-cy="moves-review-queue"]' ).should( 'be.visible' );
    cy.contains( 'Schedule fixes' ).should( 'exist' );
    cy.contains( 'Overdue follow-up' ).should( 'exist' );
    cy.contains( 'Approve and Apply' ).click();

    cy.wait( '@applySchedulePatch' );
    cy.contains( '.toast-header', 'TODD Automation' ).should( 'exist' );

    // The Automation History card only renders inside the Selected Move
    // tab (task-view-parent.component.ts defaults activeTab to
    // 'overview' - same quirk documented in moves-routes.cy.ts). The
    // sole task in this fixture is already auto-selected in the
    // background, so switching tabs is enough to reveal it.
    cy.get( '[data-cy="moves-tab-selected"]' ).click();
    cy.get( '[data-cy="moves-automation-history"]' ).should( 'be.visible' );
    cy.contains( '1 schedule update was applied.' ).should( 'exist' );
  } );

  it( 'lets a user approve suggested move automation', () => {
    const completedMove = {
      id: 'move-suggestion-1',
      title: 'Closed partner intro',
      description: 'A completed move with contact context.',
      dueDate: '2026-04-01T00:00:00.000Z',
      progress: 100,
      status: 'completed',
      priority: 'medium',
      isCompleted: true,
      needsAttention: false,
      contactIds: ['contact-1'],
      contacts: [],
      documents: [],
      images: [],
      subTasks: [],
      projectId: 'project-1',
      taskTypeId: ''
    };

    cy.intercept( 'GET', '**/moves', {
      statusCode: 200,
      body: { tasks: [completedMove] }
    } ).as( 'loadMoves' );

    cy.intercept( 'POST', '**/moves', ( req ) => {
      req.reply( {
        statusCode: 200,
        body: {
          task: {
            id: 'move-suggestion-created-1',
            ...req.body
          }
        }
      } );
    } ).as( 'createSuggestedMove' );

    cy.visitWithCypressAuth( '/moves-view', signedInUser, {
      onBeforeLoad: ( win ) => {
        win.localStorage.removeItem( 'moves-automation-settings' );
        win.localStorage.removeItem( 'moves-automation-history' );
      }
    } );

    cy.wait( '@loadMoves' );
    cy.get( '[data-cy="moves-automation-action-suggestions"]' ).should( 'not.be.disabled' ).click();
    cy.get( '[data-cy="moves-review-queue"]' ).should( 'be.visible' );
    cy.contains( 'Suggested moves' ).should( 'exist' );
    cy.contains( 'Follow up after Closed partner intro' ).should( 'exist' );
    cy.contains( 'Approve and Apply' ).click();

    cy.wait( '@createSuggestedMove' );
    cy.contains( '.toast-header', 'TODD Automation' ).should( 'exist' );

    // See the equivalent comment in the schedule-fixes test above: the
    // per-lane detail text lives in the Automation History card, which
    // only renders inside the Selected Move tab.
    cy.get( '[data-cy="moves-tab-selected"]' ).click();
    cy.get( '[data-cy="moves-automation-history"]' ).should( 'be.visible' );
    cy.contains( '1 suggested move was created.' ).should( 'exist' );
  } );
} );
