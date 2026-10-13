import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { MovesAuthService } from '../../services/moves-auth.service';
import { GettingStarted, GettingStartedService, GettingStartedStep } from '../../services/getting-started.service';

interface HelpStep {
  number: string;
  title: string;
  copy: string;
  details: string[];
  route: string;
  /** The sample team (?demo=1) for steps that point at a specific project or move. */
  queryParams?: Record<string, string>;
  action: string;
}

interface HelpPersona {
  icon: string;
  title: string;
  pain: string;
  value: string;
}

interface HelpContrast {
  typical: string;
  moves: string;
}

interface HelpQuickStart {
  title: string;
  copy: string;
  route?: string;
  action?: string;
}

interface HelpTerm {
  term: string;
  definition: string;
}

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './help.component.html',
  styleUrl: './help.component.css',
})
export class HelpComponent implements OnInit {
  /** Prerendered for search engines (app.routes.server.ts); the route sets the title. */
  private readonly meta = inject( Meta ).updateTag( {
    name: 'description',
    content: 'How to use Moves: paste a plan, read Momentum, fix the breaks, run the weekly review and set TODD’s rules. Answers to common questions.',
  } );
  /** Signed-in only: the Getting Started checklist, checked off from real data. */
  progress: GettingStarted | null = null;
  showAfterSignIn = true;

  constructor (
    private readonly authService: MovesAuthService,
    readonly gettingStarted: GettingStartedService,
  ) { }

  ngOnInit (): void {
    this.showAfterSignIn = this.gettingStarted.showAfterSignIn;
    this.authService.getUserId().subscribe( ( userId ) => {
      if ( !userId || userId === 'user not logged in' ) {
        this.progress = null;
        return;
      }
      this.gettingStarted.load().then( ( progress ) => ( this.progress = progress ) ).catch( () => ( this.progress = null ) );
    } );
  }

  toggleShowAfterSignIn ( value: boolean ): void {
    this.showAfterSignIn = value;
    this.gettingStarted.showAfterSignIn = value;
  }

  trackStep ( _index: number, step: GettingStartedStep ): string {
    return step.id;
  }

  readonly questions: string[] = [
    'Which projects broke overnight, and why?',
    'Which move has no owner, or no next action?',
    'What has gone still, and for how many days?',
    'Is anything set before the work it waits on?',
    'Who has room to take the next thing?',
  ];

  readonly personas: HelpPersona[] = [
    {
      icon: 'fa-solid fa-compass',
      title: 'Founders & operators',
      pain: 'You carry a dozen threads at once, and the one that slips is the one nobody was watching.',
      value: 'See at a glance which work has gone still and what the next move is.',
    },
    {
      icon: 'fa-solid fa-handshake',
      title: 'Sales & business development',
      pain: 'Proposals wait for a reply, and follow-ups go cold between meetings.',
      value: 'Keep every opportunity tied to a contact, an owner, and a dated next action.',
    },
    {
      icon: 'fa-solid fa-briefcase',
      title: 'Agencies & client services',
      pain: 'Client commitments, campaigns, and deliverables live in different places.',
      value: 'Connect each Move to its project, people, and files so context never gets lost.',
    },
    {
      icon: 'fa-solid fa-people-group',
      title: 'Project & team leads',
      pain: 'Status meetings exist mostly to find out who is blocked.',
      value: 'Make ownership, blockers, and momentum visible without having to ask.',
    },
  ];

  readonly contrasts: HelpContrast[] = [
    { typical: 'Records that a task exists.', moves: 'Draws every project as a line of moves against today, so a break shows the moment it happens.' },
    { typical: 'Uses vague statuses like “in progress.”', moves: 'Anchors every move to an owner and a concrete next action. A move without one is a gap.' },
    { typical: 'Lets work sit until someone asks.', moves: 'Counts the days a move has gone still and nudges the owner before it’s lost.' },
    { typical: 'Leaves the order to luck.', moves: 'Catches a move set before the work it waits on, and proposes a fix.' },
    { typical: 'Waits for you to do the admin.', moves: 'TODD hands off, reschedules and splits within rules you set, and logs every change with Undo.' },
  ];

  readonly quickStart: HelpQuickStart[] = [
    {
      title: 'Sign in',
      copy: 'Guests can look around the sample team. Plan a first move and sign in to keep it.',
      route: '/get-started',
      action: 'Sign in',
    },
    {
      title: 'Paste a plan you already have',
      copy: 'A list, a doc or meeting notes. TODD turns it into a line of moves and checks the order, owners and next actions.',
      route: '/app/new',
      action: 'New project',
    },
    {
      title: 'Read Momentum',
      copy: 'Every project is a line against today. Problems show as breaks, with TODD’s note in the margin.',
      route: '/app',
      action: 'Open Momentum',
    },
    {
      title: 'Fix the first break',
      copy: 'Give a gap an owner, apply TODD’s proposed order, or open the move and write its next action.',
    },
  ];

  readonly toddAbilities: string[] = [
    'Find gaps, stalls, wrong order, Maya’s pile-up and anyone over capacity.',
    'Hand off what Maya and it can’t do to the person with the most room.',
    'Nudge an owner after four quiet days, and reschedule internal dates within slack.',
    'Split a move when part of it is Maya’s work, so the person’s part comes first.',
    'Send the project lead what needs a decision, and a morning digest at 6am.',
  ];

  readonly terms: HelpTerm[] = [
    { term: 'Move', definition: 'One concrete piece of work with an owner, a next action and a date. Moves are the points on a project’s line.' },
    { term: 'Next action', definition: 'The specific thing that has to happen next. A move without one is a gap.' },
    { term: 'Flow map', definition: 'Each project drawn as a line of moves against today. Breaks in the line are the problems.' },
    { term: 'Gap', definition: 'A move with no owner or no next action - nobody will move it.' },
    { term: 'Stall', definition: 'A move with no activity. The number in the yellow dot is how many days it has sat still.' },
    { term: 'Out of order', definition: 'A move set before the move it waits on.' },
    { term: 'Most room', definition: 'The person on the project with the fewest open moves against their capacity.' },
    { term: 'Lanes', definition: 'Who can carry a move: TODD (admin), Maya (content) or a person.' },
    { term: 'Undo', definition: 'Every change TODD or you make is logged with the state before it. Undo puts it back, unless the move changed since.' },
    { term: 'Practice week', definition: 'TODD’s first week in a workspace: it logs what it would do and changes nothing, then switches on.' },
  ];

  readonly steps: HelpStep[] = [
    {
      number: '01',
      title: 'Start at Momentum',
      copy: 'Momentum is home for the project lead: every project as a line against today, with TODD’s notes in the margin.',
      details: [
        'Switch the range between 1 week, 3 weeks and a quarter.',
        'A dashed yellow line is a stall; a pink “?” has no owner; a violet “⇄” is out of order; a green “✓” is something TODD fixed.',
        'A note that needs you has a button; a note about something TODD did has Undo.',
        'Guests see a sample team; sign in to see your own projects.',
      ],
      route: '/app',
      action: 'Open Momentum',
    },
    {
      number: '02',
      title: 'Open a project',
      copy: 'A project’s Flow tab draws its phases and owners; Diagnosis on the right is TODD explaining each break in the first person.',
      details: [
        'Forecast, critical path and how many next actions are set sit under the line.',
        'Sequence shows the current order and TODD’s proposed fix, with what changes and what stays.',
        'Moves, People and Log list the moves, who carries them (and their capacity), and every change.',
      ],
      route: '/app/projects/harbor',
      queryParams: { demo: '1' },
      action: 'See a sample project',
    },
    {
      number: '03',
      title: 'Open a move',
      copy: 'Any dot on a line opens the move: its next action, who can do it (TODD, Maya or a person) and what happened.',
      details: [
        'Click the next action to write or change it.',
        'Give it to someone else, mark it done, or leave a note for its owner.',
        'Every step TODD took is in the timeline, with Undo.',
      ],
      route: '/app/projects/acme',
      queryParams: { demo: '1', move: 'a2' },
      action: 'See a sample move',
    },
    {
      number: '04',
      title: 'Run the weekly review',
      copy: 'Review shows only what needs a decision, one at a time, with TODD’s suggestion first.',
      details: [
        'Press 1–4 to choose, or Talk it through to park it for standup.',
        'Share to standup copies the list for your team channel.',
      ],
      route: '/app/review',
      action: 'Start a review',
    },
    {
      number: '05',
      title: 'Set TODD’s rules',
      copy: 'The TODD page shows what needs you, everything TODD did, and the rules it acts within.',
      details: [
        'Turn hand-offs, nudges, rescheduling and splits on or off.',
        'Two rules are locked: TODD never moves a client-facing or hand-set date, and never messages anyone outside the team.',
        'Pause TODD, or keep it practising, from the top of the rules.',
      ],
      route: '/app/todd',
      action: 'Open TODD',
    },
    {
      number: '06',
      title: 'Keep the team in the loop',
      copy: 'Teammates mostly hear from TODD: a push or email when a move is handed to them, a nudge when one goes quiet.',
      details: [
        'On iPhone, Done and Can’t do it are right on the notification.',
        'Can’t do it sends the move back to TODD, which routes it again and tells the lead only if a date moves.',
        'Team shows everyone’s load across projects, assistants first.',
      ],
      route: '/app/team',
      action: 'Open Team',
    },
  ];
}
