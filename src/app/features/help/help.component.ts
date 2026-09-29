import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MovesAuthService } from '../../services/moves-auth.service';
import { GettingStarted, GettingStartedService, GettingStartedStep } from '../../services/getting-started.service';

interface HelpStep {
  number: string;
  title: string;
  copy: string;
  details: string[];
  route: string;
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
    'What needs attention today?',
    'Which work is fresh, active, stalled, or at risk?',
    'Who owns the next move?',
    'Which contact, project, or document is connected to it?',
    'What action will move the work forward?',
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
    { typical: 'Records that a task exists.', moves: 'Shows how long the work has sat still, so stalled work surfaces before it is lost.' },
    { typical: 'Uses vague statuses like “in progress.”', moves: 'Anchors every Move to a concrete next action and an owner.' },
    { typical: 'Keeps tasks in isolation.', moves: 'Links each Move to the people, projects, documents, and images it depends on.' },
    { typical: 'Waits for you to go looking for problems.', moves: 'TODD points out aging work, blockers, and missing context for you.' },
    { typical: 'Leaves planning to you.', moves: 'Mission turns a goal into a proposed plan of Moves that you review and approve.' },
  ];

  readonly quickStart: HelpQuickStart[] = [
    {
      title: 'Sign in',
      copy: 'Guests can look around. Plan your first Move and sign in to keep it.',
      route: '/get-started',
      action: 'Sign in',
    },
    {
      title: 'Create your first Move',
      copy: 'Pick something real that is waiting on you. Give it a clear title, a next action, and a due date.',
      route: '/move',
      action: 'New Move',
    },
    {
      title: 'Find it on the Execution board',
      copy: 'This board is where you will start each day: scan what is active, blocked, or waiting.',
      route: '/moves-view',
      action: 'Open Execution',
    },
    {
      title: 'Ask TODD about it',
      copy: 'Open the Move, move to the bottom-right corner, and ask TODD, “What is the next step here?”',
    },
  ];

  readonly toddAbilities: string[] = [
    'Explain the page you are on and what to do next.',
    'Spot blockers, missing context, and work that is aging.',
    'Draft status updates, stakeholder updates, escalations, and decision requests.',
    'Turn a goal into a Mission plan of proposed Moves.',
    'Take on AI Missions and report back for your approval.',
  ];

  readonly terms: HelpTerm[] = [
    { term: 'Move', definition: 'One concrete piece of work, with enough context (owner, next action, dates, people, files) for someone to move it forward.' },
    { term: 'Next action', definition: 'The specific thing that has to happen next for a Move to make progress.' },
    { term: 'Momentum', definition: 'How recently a Move has progressed. Fresh work is moving; stalled work has gone still and needs attention.' },
    { term: 'Moves Home', definition: 'Your overview: health meters and a diagnosis board showing what is active, what is at risk, and where to look next.' },
    { term: 'Command deck', definition: 'The shortcut panel on Moves Home for jumping into Execution, New Move, or Mission.' },
    { term: 'Execution board', definition: 'The board view of your Moves, grouped by status and lane. It is your daily working surface.' },
    { term: 'Mission', definition: 'A goal you hand to TODD. TODD proposes a plan and a set of Moves, and none of them become real until you approve.' },
    { term: 'AI Missions', definition: 'The list of work TODD is responsible for: waiting for approval, in progress, completed, or needing your direction.' },
    { term: 'Focus Mode', definition: 'A distraction-free view for working through a single mission.' },
  ];

  readonly steps: HelpStep[] = [
    {
      number: '01',
      title: 'Start at Moves Home',
      copy: 'Moves Home is your execution cockpit. It gives you a high-level view of what is active, what is at risk, and where work needs attention next.',
      details: [
        'Review the health meters and the diagnosis board for your current work.',
        'Use the command deck to jump into Execution, New Move, or Mission.',
        'Let TODD surface aging work, missing context, blockers, and next actions.',
        'Guests can preview the workspace; sign in to see and save your live Moves.',
      ],
      route: '/app',
      action: 'Try Moves Home',
    },
    {
      number: '02',
      title: 'Create a Move',
      copy: 'A Move is a concrete piece of work with enough context for a person—or TODD—to move it forward.',
      details: [
        'Give the Move a clear title and describe the outcome or work required.',
        'Add notes, due dates, scheduled start dates, status, type, and project.',
        'Assign the Move to an active user and relate the people who matter to it.',
        'Attach existing documents or images when the work depends on supporting material.',
        'Add subtasks when the Move is easier to complete as a sequence of smaller actions.',
        'Use the time-worked fields to record when execution actually started and stopped.',
      ],
      route: '/move',
      action: 'Try New Move',
    },
    {
      number: '03',
      title: 'Work from the Execution board',
      copy: 'Execution is the board view for the Moves you need to work. Use it to scan status, focus on the right lane, and open the details behind a task.',
      details: [
        'Review work by its current status and execution lane.',
        'Open a Move to read its description, notes, relationships, files, and subtasks.',
        'Update the status as the work moves from not started to active, blocked, or complete.',
        'Use the board as the daily starting point for deciding what should happen next.',
      ],
      route: '/moves-view',
      action: 'Try Execution',
    },
    {
      number: '04',
      title: 'Use TODD to move work forward',
      copy: 'TODD can help you understand a Move, identify missing context, draft updates, and recommend the next action based on the work around it.',
      details: [
        'Open a Move and ask TODD about the blocker, next action, or missing information.',
        'Use notes to leave direction, answer a question, or record a decision for the people involved.',
        'Ask TODD to draft a status update, stakeholder update, blocker escalation, or decision request.',
        'When context is missing, add the related contact, document, project, or supporting asset to the Move.',
      ],
      route: '/moves-view',
      action: 'Try the Execution board',
    },
    {
      number: '05',
      title: 'Give TODD a mission',
      copy: 'Mission turns a problem or goal into an operating plan. Give TODD the outcome, constraints, resources, and stakeholders, then review the proposed Moves before approving them.',
      details: [
        'Describe the mission title, problem, and desired outcome.',
        'List the people, budget, tools, and assets TODD can work with.',
        'Add stakeholders, constraints, timeline, and success criteria when you know them.',
        'Review the generated plan and planned Moves in the preview.',
        'Approve the plan to create real Moves, or edit the intake and regenerate it.',
        'Use Focus Mode when you want to work through the mission without the surrounding workspace.',
      ],
      route: '/plan',
      action: 'Try Mission',
    },
    {
      number: '06',
      title: 'Review AI Missions',
      copy: 'AI Missions collects work assigned to TODD so you can see what is waiting for approval, in progress, completed, or needs your direction.',
      details: [
        'Open AI Missions to review work TODD is responsible for.',
        'Filter or open a mission to inspect its objective, criteria, and current state.',
        'Approve, redirect, or update the work when human judgment is needed.',
        'Use the resulting Moves and notes as the operational record of what happened.',
      ],
      route: '/ai-missions',
      action: 'Try AI Missions',
    },
  ];
}
