import { addDays, fmtDay, isoDay } from './flow-dates';
import { defaultRules, FlowState, MAYA_ID, TODD_ID } from './flow-engine';
import { FlowMove, FlowProject, Lane, Person, ToddAction } from './flow.models';

/**
 * The design's sample team (Dana's 14 people, 5 projects), dated relative
 * to today so the lines always break in the same places. Shown to
 * signed-out visitors and with ?demo=1.
 */
export function demoState ( now = new Date() ): FlowState {
  const d = ( n: number ) => isoDay( addDays( now, n ) );
  const at = ( dayOffset: number, h: number, m: number ) => {
    const x = addDays( now, dayOffset );
    x.setHours( h, m, 0, 0 );
    return x.toISOString();
  };

  const person = ( id: string, name: string, role: string, capacity = 6, kind: Lane = 'person' ): Person => ( {
    id, name, role, capacity, kind, initials: name.split( ' ' ).map( w => w[0] ).join( '' ).slice( 0, 2 ).toUpperCase(),
  } );

  const people: Person[] = [
    person( MAYA_ID, 'Marketing Assistant', 'Assistant · content', 6, 'maya' ),
    person( TODD_ID, 'General Assistant', 'Assistant · admin', 10, 'todd' ),
    person( 'dana', 'Dana Reyes', 'Project lead', 8 ),
    person( 'sam', 'Sam Kim', 'Content', 5 ),
    person( 'luis', 'Luis Mora', 'Accounts', 6 ),
    person( 'priya', 'Priya Shah', 'Engineering', 6 ),
    person( 'ken', 'Ken Ortiz', 'Ops', 7 ),
    person( 'aisha', 'Aisha Bello', 'Design lead' ),
    person( 'jordan', 'Jordan Lee', 'Design' ),
    person( 'rita', 'Rita Okafor', 'People' ),
    person( 'mei', 'Mei Chen', 'Engineering' ),
    person( 'omar', 'Omar Haddad', 'Engineering' ),
    person( 'theo', 'Theo Park', 'QA' ),
    person( 'nia', 'Nia Brooks', 'Marketing' ),
    person( 'gabe', 'Gabe Ruiz', 'Sales' ),
    person( 'lena', 'Lena Vogel', 'Support' ),
  ];

  const projects: FlowProject[] = [
    { id: 'harbor', name: 'Harbor app launch', shipsOn: d( 22 ), client: 'Harbor Inc.', value: '$180k contract', phases: ['Plan', 'Build', 'QA', 'Launch'], memberIds: ['priya', 'ken', 'sam', 'dana'] },
    { id: 'acme', name: 'Acme onboarding', client: 'Acme', value: '$24k renewal', memberIds: ['luis', 'ken', 'sam', 'dana'] },
    { id: 'brand', name: 'Brand refresh', memberIds: ['aisha', 'jordan', 'ken', 'dana'] },
    { id: 'hiring', name: 'Q4 hiring', memberIds: ['rita', 'ken', 'dana'] },
    { id: 'migration', name: 'Site migration', memberIds: ['ken', 'priya', 'omar'] },
  ];

  const mv = ( m: Partial<FlowMove> & Pick<FlowMove, 'id' | 'projectId' | 'title' | 'due'> ): FlowMove => ( {
    nextAction: '', assigneeId: null, lane: 'person', done: false, dependsOn: [], lastActivityAt: at( -1, 16, 0 ), history: [], ...m,
  } );

  const moves: FlowMove[] = [
    // Harbor app launch
    mv( { id: 'h1', projectId: 'harbor', title: 'Scope', phase: 'Plan', assigneeId: 'priya', due: d( -7 ), done: true, nextAction: 'Done' } ),
    mv( { id: 'h2', projectId: 'harbor', title: 'API v2', phase: 'Build', assigneeId: 'ken', due: d( -4 ), done: true, nextAction: 'Done', dependsOn: ['h1'] } ),
    mv( { id: 'h3', projectId: 'harbor', title: 'Homepage copy', phase: 'Build', assigneeId: 'sam', due: d( -3 ), nextAction: 'Finish the hero and pricing sections', lastActivityAt: at( -6, 11, 20 ), dependsOn: ['h1'] } ),
    mv( {
      id: 'h4', projectId: 'harbor', title: 'QA sign-off', phase: 'QA', due: d( 2 ), nextAction: 'Run the v2 QA checklist and sign off', dependsOn: ['h2', 'h3'],
      laneNotes: { todd: 'Can’t. Sign-off needs a person’s judgment.', maya: 'Can’t. QA isn’t content work.' },
    } ),
    mv( { id: 'h5', projectId: 'harbor', title: 'Beta invites', phase: 'QA', lane: 'maya', due: d( 4 ), nextAction: 'Send invites to the 40 beta testers', dependsOn: ['h4'], createdBy: 'maya', lastActivityAt: at( 0, 6, 55 ) } ),
    mv( { id: 'h6', projectId: 'harbor', title: 'Store listing', phase: 'Launch', assigneeId: 'sam', due: d( 8 ), nextAction: 'Upload screenshots and the description', dependsOn: ['h4'] } ),
    mv( { id: 'h8', projectId: 'harbor', title: 'Release notes', phase: 'Launch', assigneeId: 'ken', due: d( 10 ), nextAction: 'Draft from the v2 changelog', dependsOn: ['h4'] } ),
    mv( { id: 'h7', projectId: 'harbor', title: 'Launch', phase: 'Launch', assigneeId: 'dana', due: d( 22 ), nextAction: 'Press publish in both stores', dependsOn: ['h5', 'h6', 'h8'], dateLockedBy: 'client' } ),

    // Acme onboarding
    mv( { id: 'a1', projectId: 'acme', title: 'Kickoff call', assigneeId: 'luis', due: d( -6 ), done: true, nextAction: 'Done' } ),
    mv( {
      id: 'a2', projectId: 'acme', title: 'Price the Acme add-ons', short: 'Pricing', phase: 'Renewal', assigneeId: 'luis', due: d( -2 ), lastActivityAt: at( -8, 10, 0 ),
      nextAction: 'Price the 3 add-ons in the renewal sheet and mark them approved', createdBy: 'maya', laneEnteredAt: at( -8, 10, 0 ),
      laneNotes: { todd: 'Can’t. Pricing needs a person’s judgment.', maya: 'Can’t price. Will write the cover email after.', person: 'Owns the Acme account.' },
      history: [
        { at: at( -8, 9, 0 ), text: 'The Marketing Assistant created “Send renewal proposal” from its daily plan', by: 'maya' },
        { at: at( -7, 9, 0 ), label: `${fmtDay( addDays( now, -7 ) )}–${addDays( now, -1 ).getDate()}`, text: 'No progress. The Marketing Assistant noted “needs pricing before I can draft”', by: 'maya' },
        { at: at( 0, 9, 3 ), text: 'Luis notified by push', by: 'system' },
      ],
    } ),
    mv( { id: 'a3', projectId: 'acme', title: 'Renewal cover email', lane: 'maya', due: d( 3 ), dependsOn: ['a2'], nextAction: 'Write the cover email once pricing is approved', createdBy: 'todd', lastActivityAt: at( 0, 9, 2 ) } ),
    mv( { id: 'a4', projectId: 'acme', title: 'Call Acme ops lead', assigneeId: 'luis', due: d( 8 ), nextAction: 'Book 30 minutes with their ops lead' } ),
    mv( { id: 'a5', projectId: 'acme', title: 'Training session', assigneeId: 'ken', due: d( 11 ), nextAction: 'Send the training agenda' } ),

    // Brand refresh
    mv( { id: 'b1', projectId: 'brand', title: 'Creative brief', assigneeId: 'aisha', due: d( -6 ), done: true, nextAction: 'Done' } ),
    mv( { id: 'b2', projectId: 'brand', title: 'Moodboard', assigneeId: 'jordan', due: d( -2 ), done: true, nextAction: 'Done', dependsOn: ['b1'] } ),
    mv( {
      id: 'b3', projectId: 'brand', title: 'Design kickoff', assigneeId: 'jordan', due: d( 6 ), nextAction: 'Run kickoff with the vendor team', dependsOn: ['b2', 'b4'],
      dateLockedBy: 'manual', dateLockedById: 'jordan', orderNote: 'Aisha marked kickoff as “needs signed contract” on Sep 30.',
    } ),
    mv( { id: 'b4', projectId: 'brand', title: 'Vendor contract', assigneeId: 'ken', due: d( 9 ), nextAction: 'Get the vendor contract signed' } ),
    mv( { id: 'b5', projectId: 'brand', title: 'Concepts', assigneeId: 'jordan', due: d( 13 ), nextAction: 'Three directions for review', dependsOn: ['b3'] } ),
    mv( { id: 'b6', projectId: 'brand', title: 'Review', assigneeId: 'dana', due: d( 20 ), nextAction: 'Pick a direction with the client', dependsOn: ['b5'], dateLockedBy: 'client' } ),

    // Q4 hiring
    mv( { id: 'q1', projectId: 'hiring', title: 'Job descriptions', assigneeId: 'rita', due: d( -7 ), done: true, nextAction: 'Done' } ),
    mv( { id: 'q2', projectId: 'hiring', title: 'Post roles', assigneeId: 'rita', due: d( -4 ), done: true, nextAction: 'Done' } ),
    mv( { id: 'q3', projectId: 'hiring', title: 'Screen applicants', assigneeId: 'rita', due: d( -1 ), done: true, nextAction: 'Done' } ),
    mv( { id: 'q4', projectId: 'hiring', title: 'Send recap', assigneeId: 'ken', due: d( 3 ), nextAction: 'Send the interview recap once approved', createdBy: 'maya', lastActivityAt: at( -1, 17, 2 ) } ),
    mv( { id: 'q5', projectId: 'hiring', title: 'Offer letters', assigneeId: 'rita', due: d( 9 ), nextAction: 'Draft offers for the two finalists' } ),

    // Site migration
    mv( { id: 'sm1', projectId: 'migration', title: 'Inventory pages', assigneeId: 'omar', due: d( -6 ), done: true, nextAction: 'Done' } ),
    mv( { id: 'sm2', projectId: 'migration', title: 'Staging copy', assigneeId: 'priya', due: d( -1 ), done: true, nextAction: 'Done' } ),
    mv( { id: 'sm3', projectId: 'migration', title: 'DNS cutover', lane: 'todd', due: d( 4 ), nextAction: 'Switch DNS during the host’s Friday window', lastActivityAt: at( 0, 6, 40 ) } ),
    mv( { id: 'sm4', projectId: 'migration', title: 'Redirect audit', assigneeId: 'omar', due: d( 11 ), nextAction: 'Check the top 200 URLs' } ),

    // Not in a project: Maya's daily plans, TODD's admin, Sam's content queue.
    mv( { id: 'm1', projectId: '', mayaReview: true, title: 'Harbor teaser post', lane: 'maya', due: d( -2 ), nextAction: 'Needs a client-approved date', createdBy: 'maya', lastActivityAt: at( 0, 8, 0 ) } ),
    mv( { id: 'm2', projectId: '', mayaReview: true, title: 'Acme welcome email', lane: 'maya', due: d( -1 ), nextAction: 'Needs a client-approved date', createdBy: 'maya', lastActivityAt: at( 0, 8, 0 ) } ),
    mv( { id: 'm3', projectId: '', mayaReview: true, title: 'Q4 job post images', lane: 'maya', due: d( 0 ), nextAction: 'Six sizes for the job boards', createdBy: 'maya', lastActivityAt: at( 0, 8, 0 ) } ),
    mv( { id: 'm4', projectId: '', mayaReview: true, title: 'October newsletter', lane: 'maya', due: d( 0 ), nextAction: 'Draft from this month’s wins', createdBy: 'maya', lastActivityAt: at( 0, 8, 0 ) } ),
    mv( { id: 'm5', projectId: '', title: 'Brand preview post', lane: 'maya', due: d( 0 ), nextAction: 'Teaser for the new look', createdBy: 'maya', lastActivityAt: at( 0, 8, 0 ) } ),
    mv( { id: 'm6', projectId: '', title: 'Case study draft', lane: 'maya', due: d( 5 ), nextAction: 'Draft the Harbor case study', createdBy: 'maya', lastActivityAt: at( 0, 8, 0 ) } ),
    mv( { id: 'm7', projectId: '', title: 'Migration notice email', lane: 'maya', due: d( 10 ), nextAction: 'Tell customers about the new site', createdBy: 'maya', lastActivityAt: at( 0, 8, 0 ) } ),
    mv( { id: 't1', projectId: '', title: 'Vendor W-9', lane: 'todd', due: d( 2 ), nextAction: 'Collect the vendor’s W-9' } ),
    mv( { id: 't2', projectId: '', title: 'Kickoff invite', lane: 'todd', due: d( 5 ), nextAction: 'Send the kickoff calendar invite' } ),
    mv( { id: 's1', projectId: '', title: 'Launch blog post', assigneeId: 'sam', due: d( 3 ), nextAction: 'Outline the launch post' } ),
    mv( { id: 's2', projectId: '', title: 'FAQ update', assigneeId: 'sam', due: d( 5 ), nextAction: 'Add the v2 questions' } ),
    mv( { id: 's3', projectId: '', title: 'Help center screenshots', assigneeId: 'sam', due: d( 6 ), nextAction: 'Retake for the new UI' } ),
    mv( { id: 's4', projectId: '', title: 'Launch email', assigneeId: 'sam', due: d( 12 ), nextAction: 'Draft the launch email' } ),
    mv( { id: 'p1', projectId: '', title: 'Load test', assigneeId: 'priya', due: d( 3 ), nextAction: 'Run the 10k-user test' } ),
    mv( { id: 'l1', projectId: '', title: 'Acme invoice', assigneeId: 'luis', due: d( 12 ), nextAction: 'Send the October invoice' } ),
  ];

  const act = ( a: Omit<ToddAction, 'auto'> & { auto?: boolean } ): ToddAction => ( { auto: true, ...a } );
  const actions: ToddAction[] = [
    act( {
      id: 'act-acme-reassign', type: 'reassigned', moveId: 'a2', projectId: 'acme', ruleId: 'handoff', createdAt: at( 0, 9, 2 ),
      subject: 'Acme pricing', text: 'from the Marketing Assistant to Luis. The Marketing Assistant can’t price add-ons.',
      note: 'Moved Acme pricing from the Marketing Assistant to Luis. The Marketing Assistant can’t price.', title: 'Acme pricing moved to Luis',
      reason: 'Rule: hand off what the Marketing Assistant can’t do.',
      changes: [{ moveId: 'a2', before: { assigneeId: null, lane: 'maya' }, after: { assigneeId: 'luis', lane: 'person' } }],
    } ),
    act( {
      id: 'act-acme-split', type: 'split', moveId: 'a2', projectId: 'acme', ruleId: 'split', createdAt: at( 0, 9, 1 ),
      subject: 'Renewal proposal', text: 'into pricing (Luis) and cover email (Marketing Assistant, waits on Luis).',
      title: 'Renewal proposal split', reason: '16Ahead split it: pricing to Luis, cover email stays with the Marketing Assistant and waits. Rule: hand off what the Marketing Assistant can’t do.',
      changes: [
        { moveId: 'a2', before: { title: 'Send renewal proposal', nextAction: 'Price the add-ons and send the renewal proposal' }, after: { title: 'Price the Acme add-ons', nextAction: 'Price the 3 add-ons in the renewal sheet and mark them approved' } },
        { moveId: 'a3', before: null, after: {} },
      ],
    } ),
    act( {
      id: 'act-sam-nudge', type: 'nudged', moveId: 'h3', projectId: 'harbor', ruleId: 'nudge', createdAt: at( 0, 7, 10 ),
      subject: 'Sam', text: 'on Homepage copy, still for 6 days.', reason: 'Rule: nudge after 4 days of no activity.', changes: [],
    } ),
    act( {
      id: 'act-recap', type: 'reassigned', moveId: 'q4', projectId: 'hiring', ruleId: 'handoff', createdAt: at( -1, 17, 2 ),
      subject: 'Send recap', text: 'from the Marketing Assistant to Ken. It needs a signed approval.', reason: 'Rule: hand off what the Marketing Assistant can’t do.',
      changes: [{ moveId: 'q4', before: { assigneeId: null, lane: 'maya' }, after: { assigneeId: 'ken', lane: 'person' } }],
    } ),
    act( {
      id: 'act-beta', type: 'rescheduled', moveId: 'h5', projectId: 'harbor', ruleId: 'reschedule', createdAt: at( 0, 6, 55 ),
      subject: 'Beta invites', text: '2 days later, so they follow QA.', title: 'Beta invites moved after QA',
      reason: 'Invites were set to go out before testing ends.',
      changes: [{ moveId: 'h5', before: { due: d( 2 ) }, after: { due: d( 4 ) } }],
    } ),
    act( {
      id: 'act-dns', type: 'rescheduled', moveId: 'sm3', projectId: 'migration', ruleId: 'reschedule', createdAt: at( 0, 6, 40 ),
      subject: 'DNS cutover', text: 'to Fri. The host confirmed a Friday window.', note: 'Rescheduled DNS cutover to Fri.', title: 'DNS cutover moved to Fri',
      reason: 'The host confirmed a Friday window.',
      changes: [{ moveId: 'sm3', before: { due: d( 2 ) }, after: { due: d( 4 ) } }],
    } ),
    ...olderActions( at ),
  ];

  return { people, projects, moves, actions, rules: defaultRules(), dismissed: {}, now, pmId: 'dana' };
}

/** Five smaller fixes from earlier this morning - the "Show 5 more" in the log. */
function olderActions ( at: ( d: number, h: number, m: number ) => string ): ToddAction[] {
  const rows: [string, string, string, string, ToddAction['type'], number, number][] = [
    ['n1', 'Rita', 'on Offer letters, nothing for 4 days.', 'hiring', 'nudged', 6, 30],
    ['n2', 'Kickoff invite', 'drafted for Jordan to send.', 'brand', 'nudged', 6, 20],
    ['n3', 'Omar', 'on Redirect audit, nothing for 4 days.', 'migration', 'nudged', 6, 10],
    ['n4', 'Vendor W-9', 'request sent to Ken.', 'brand', 'nudged', 6, 5],
    ['n5', 'Training session', 'agenda reminder to Ken.', 'acme', 'nudged', 6, 0],
  ];
  return rows.map( ( [id, subject, text, projectId, type, h, m] ) => ( {
    id: `act-${id}`, type, moveId: '', projectId, subject, text, reason: 'Rule: nudge after 4 days of no activity.', ruleId: 'nudge', auto: true, changes: [], createdAt: at( 0, h, m ),
  } ) );
}
