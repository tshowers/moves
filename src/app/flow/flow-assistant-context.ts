import { MovesAssistantPageContext } from '../services/moves-assistant-signal.service';
import { fmtDay } from './flow-dates';
import {
  criticalPath, daysStill, downstream, firstName, forecast, issuesForProject, isOpen, liveActions, loadOf, marginNote, moveById,
  needsYou, nextActionsSet, ownerOf, projectHealth, projectMoves,
} from './flow-engine';
import { Autonomy, Issue } from './flow.models';
import { FlowState } from './flow-engine';

/** Everything the builder reads, so it stays a pure function of the screen. */
export interface FlowContextInput {
  url: string;
  state: FlowState;
  issues: Issue[];
  autonomy: Autonomy;
  isSample: boolean;
}

type Page = 'momentum' | 'team' | 'todd' | 'digest' | 'project' | 'review' | 'new-project' | 'my-moves';

const PAGES: Record<Page, { title: string; description: string }> = {
  'momentum': {
    title: 'Momentum',
    description: 'The project lead\'s home: every project drawn as a line of moves against today. Breaks in a line are problems - a gap (no owner or no next action), a stall (no activity, shown in days), a move set before something it waits on, or something 16Ahead fixed. 16Ahead\'s note for each project sits in the margin; notes that need the lead have a button, notes about what 16Ahead did have Undo.',
  },
  'project': {
    title: 'Project',
    description: 'One project: its line by phase with each move\'s owner, a forecast, the critical path, how many next actions are set, and 16Ahead\'s Diagnosis (each break explained, with a fix). Tabs: Flow, Sequence (current order and 16Ahead\'s proposed reorder), Moves, People (load and capacity), Log.',
  },
  'team': {
    title: 'Team',
    description: 'Each person\'s open moves across every project for the next two weeks, with their load against capacity. Marketing Assistant (content assistant) and 16Ahead (admin assistant) come first; the last row is moves with no owner.',
  },
  'todd': {
    title: '16Ahead',
    description: 'What needs the lead, everything 16Ahead did (every entry has Undo, practice entries say "Would have"), and the rules 16Ahead acts within. 16Ahead can be on, practising (logs only) or paused.',
  },
  'digest': {
    title: 'Morning digest',
    description: 'Which lines broke overnight with a one-tap fix for each, and what 16Ahead fixed on its own. The same content goes out as the 6am email.',
  },
  'review': {
    title: 'Weekly review',
    description: 'One decision at a time, only what needs the lead, with 16Ahead\'s suggestion first. Keys 1-4 choose; "Talk it through" parks an item for standup.',
  },
  'new-project': {
    title: 'New project',
    description: 'Paste a plan (a list, doc or notes). 16Ahead turns it into a line of moves and checks it before anyone starts: wrong order, no owner (The Marketing Assistant can take content work), no next action - each with a one-tap fix. Then team and rules, then create.',
  },
  'my-moves': {
    title: 'My next moves',
    description: 'A teammate\'s own open moves, newest hand-off from 16Ahead first, with Done and Can\'t do it. Can\'t do it sends the move back to 16Ahead to route again; the lead hears only if a date moves.',
  },
};

function pageOf ( path: string ): { page: Page; projectId?: string; tab?: string } {
  const parts = path.split( '/' ).filter( Boolean ); // ['app', ...]
  switch ( parts[1] ) {
    case 'team': return { page: 'team' };
    case 'todd': return { page: 'todd' };
    case 'digest': return { page: 'digest' };
    case 'review': return { page: 'review' };
    case 'new': return { page: 'new-project' };
    case 'me': return { page: 'my-moves' };
    case 'projects': return { page: 'project', projectId: parts[2], tab: parts[3] || 'flow' };
    default: return { page: 'momentum' };
  }
}

function issueLine ( s: FlowState, i: Issue ) {
  return { kind: i.kind, status: i.status, title: i.title, project: s.projects.find( p => p.id === i.projectId )?.name || '', explanation: i.explanation };
}

/**
 * The assistant's view of the flow-map screen you're on - what TODD's chat
 * reads (MovesAssistantSignalService) and what the launcher's guidance card
 * is built from. Built from the same engine as the screen, so the chat and
 * the page never disagree.
 */
export function flowPageContext ( input: FlowContextInput ): MovesAssistantPageContext {
  const { state: s, issues, autonomy, isSample } = input;
  const [pathPart, query = ''] = input.url.split( '#' )[0].split( '?' );
  const where = pageOf( pathPart );
  const meta = PAGES[where.page];
  const open = needsYou( issues );
  const today = liveActions( s ).filter( a => a.auto && new Date( a.createdAt ).toDateString() === s.now.toDateString() );

  const summary: Record<string, unknown> = {
    isSample,
    todd: autonomy.mode,
    toddPracticeEndsAt: autonomy.mode === 'dry_run' ? autonomy.practiceEndsAt || '' : undefined,
    projectCount: s.projects.length,
    peopleCount: s.people.filter( p => p.kind === 'person' ).length,
    needsYouCount: open.length,
    needsYou: open.slice( 0, 6 ).map( i => issueLine( s, i ) ),
    toddFixedToday: today.length,
  };
  const dataPreview: Record<string, unknown> = {};
  let title = meta.title;

  switch ( where.page ) {
    case 'momentum':
    case 'digest':
      dataPreview['projects'] = s.projects.slice( 0, 10 ).map( p => {
        const note = marginNote( s, p.id, issues );
        return {
          name: p.name,
          health: projectHealth( s, p, issues ).label,
          margin: note.kind === 'needs' ? note.issue.title : note.kind === 'did' ? `${note.action.subject} ${note.action.text}` : note.kind === 'watch' ? note.text : 'Nothing to flag',
        };
      } );
      break;
    case 'project': {
      const p = s.projects.find( x => x.id === where.projectId );
      if ( !p ) break;
      title = `${p.name} (${where.tab})`;
      const nas = nextActionsSet( s, p.id );
      Object.assign( summary, {
        project: p.name,
        tab: where.tab,
        health: projectHealth( s, p, issues ).label,
        shipsOn: p.shipsOn ? fmtDay( p.shipsOn ) : '',
        forecast: forecast( s, p, issues ).title,
        criticalPath: criticalPath( s, p.id ).map( m => m.title ),
        nextActionsSet: `${nas.set} of ${nas.total}`,
      } );
      dataPreview['diagnosis'] = issuesForProject( issues, p.id ).map( i => issueLine( s, i ) );
      dataPreview['moves'] = projectMoves( s, p.id ).slice( 0, 20 ).map( m => ( {
        title: m.title, owner: firstName( ownerOf( s, m ) ), due: fmtDay( m.due ), done: m.done, nextAction: m.nextAction || '(none)',
      } ) );
      break;
    }
    case 'team':
      dataPreview['people'] = s.people.map( p => ( { name: p.name, role: p.role, load: loadOf( s, p.id ).length, capacity: p.capacity } ) )
        .filter( p => p.load > 0 ).slice( 0, 20 );
      summary['overCapacity'] = s.people.filter( p => p.kind === 'person' && loadOf( s, p.id ).length > p.capacity ).map( p => p.name );
      summary['noOwnerCount'] = s.moves.filter( m => isOpen( m ) && m.lane === 'person' && !m.assigneeId ).length;
      break;
    case 'todd':
      summary['rules'] = s.rules.map( r => ( { rule: `${r.lead} ${r.text}`, on: r.enabled, locked: r.locked } ) );
      dataPreview['recentLog'] = [...s.actions].sort( ( a, b ) => b.createdAt.localeCompare( a.createdAt ) ).slice( 0, 8 )
        .map( a => `${a.dryRun ? '(would have) ' : ''}${a.undoneAt ? '(undone) ' : ''}${a.subject} ${a.text}` );
      break;
    case 'review':
      summary['decisionsLeft'] = open.length;
      break;
    case 'my-moves': {
      const me = isSample ? 'luis' : s.pmId;
      const mine = s.moves.filter( m => isOpen( m ) && m.lane === 'person' && m.assigneeId === me );
      summary['myOpenMoves'] = mine.length;
      dataPreview['myMoves'] = mine.slice( 0, 10 ).map( m => ( { title: m.title, due: fmtDay( m.due ), nextAction: m.nextAction } ) );
      break;
    }
    case 'new-project':
      break;
  }

  // A move open in the drawer is what the person is looking at.
  const moveId = new URLSearchParams( query ).get( 'move' );
  const move = moveId ? moveById( s, moveId ) : undefined;
  const context: MovesAssistantPageContext = {
    feature: 'moves',
    page: where.page,
    route: input.url,
    mode: isSample ? 'sample' : 'live',
    title,
    description: meta.description + ( isSample ? ' This is the sample team (signed out or ?demo=1), not the person\'s own data.' : '' ),
    summary,
    dataPreview,
  };
  if ( move ) {
    const owner = ownerOf( s, move );
    context.selectedEntityType = 'move';
    context.selectedEntityId = move.id;
    context.title = `${move.title} (open on ${meta.title})`;
    context.dataPreview = {
      ...dataPreview,
      move: {
        title: move.title,
        project: s.projects.find( p => p.id === move.projectId )?.name || 'Not in a project',
        owner: owner ? owner.name : 'No owner',
        lane: move.lane,
        due: fmtDay( move.due ),
        done: move.done,
        nextAction: move.nextAction || '(none - this is a gap)',
        daysStill: daysStill( s, move ),
        dateLocked: move.dateLockedBy || '',
        blocks: downstream( s, move.id ).filter( isOpen ).map( m => m.title ),
        issues: issues.filter( i => i.moveIds.includes( move.id ) ).map( i => issueLine( s, i ) ),
      },
    };
  }
  return context;
}
