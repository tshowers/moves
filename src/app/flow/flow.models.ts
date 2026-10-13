/**
 * Flow map (team edition) - design_handoff_moves_flow_map. Moves is the
 * PM's assistant for an 8-25 person team: every project is a line of
 * moves against today, and TODD finds the breaks (gaps, stalls, wrong
 * order, pile-ups) and fixes what its rules allow, logging each fix with
 * Undo.
 */

/** Who can carry out a move. TODD = admin lane, Maya = content lane. */
export type Lane = 'todd' | 'maya' | 'person';

export interface Person {
  id: string;
  name: string;
  initials: string;
  role: string;
  kind: Lane;
  /** Open moves this person can carry in the window before they're "full". */
  capacity: number;
}

export interface MoveEvent {
  at: string;
  /** Short date label when the event spans days ("Oct 6-12"). */
  label?: string;
  text: string;
  /** Green dot for things TODD did, grey for everything else. */
  by?: 'todd' | 'maya' | 'person' | 'system';
  actionId?: string;
}

export interface FlowMove {
  id: string;
  projectId: string;
  title: string;
  /** Short name for labels on the line ("Pricing"). */
  short?: string;
  /** Required for active moves - an empty value is a gap. */
  nextAction: string;
  assigneeId: string | null;
  lane: Lane;
  /** ISO date (yyyy-mm-dd or full ISO). */
  due: string;
  done: boolean;
  dependsOn: string[];
  lastActivityAt: string;
  /** Dates TODD must never move. */
  dateLockedBy?: 'client' | 'manual';
  /** Who set a manual lock - "it moves a date Jordan set". */
  dateLockedById?: string;
  /** When the move entered TODD's or Maya's lane (48h rule). */
  laneEnteredAt?: string;
  phase?: string;
  createdBy?: Lane;
  /** Why the lanes can or can't do this move - shown in WHO CAN DO THIS. */
  laneNotes?: Partial<Record<Lane, string>>;
  /** Why this order matters ("Aisha marked kickoff as ..."). */
  orderNote?: string;
  history: MoveEvent[];
}

export interface FlowProject {
  id: string;
  name: string;
  shipsOn?: string;
  client?: string;
  value?: string;
  phases?: string[];
  memberIds: string[];
  /** The project lead: who gets "needs you" for this project. */
  leadId?: string;
}

export type ToddActionType = 'reassigned' | 'split' | 'nudged' | 'rescheduled' | 'assigned' | 'sequenced' | 'completed' | 'created';

/** One move's state before and after an action. `before: null` means the action created it. */
export interface MoveChange {
  moveId: string;
  before: Partial<FlowMove> | null;
  after: Partial<FlowMove> | null;
}

export interface ToddAction {
  id: string;
  type: ToddActionType;
  moveId: string;
  projectId: string;
  /** Bold lead-in of the log row ("Acme pricing"). */
  subject: string;
  /** Rest of the log row ("from Maya to Luis. Maya can't price add-ons."). */
  text: string;
  /** Margin-note / Diagnosis-card wording, when it differs from subject + text. */
  note?: string;
  /** Diagnosis-card title ("Beta invites moved after QA"). */
  title?: string;
  reason: string;
  ruleId?: string;
  /** True when TODD did it on its own; false when it ran a PM decision. */
  auto: boolean;
  changes: MoveChange[];
  createdAt: string;
  undoneAt?: string;
  /** Logged during TODD's practice week: what it would have done. Nothing changed, nothing to undo. */
  dryRun?: boolean;
  /** Who TODD told, and how (email until the iOS app takes push). */
  notified?: { uid: string; channel: string; ok: boolean }[];
}

/** Whether TODD acts on its own: practising (logs only), on, or off. */
export interface Autonomy {
  mode: 'dry_run' | 'on' | 'off';
  /** When the practice week ends and TODD switches itself on (unless someone chose). */
  practiceEndsAt?: string;
  chosenBy?: string;
}

export interface ToddRule {
  id: string;
  /** Bold lead-in. */
  lead: string;
  text: string;
  enabled: boolean;
  locked: boolean;
  params?: Record<string, number>;
}

export type IssueKind = 'gap' | 'stall' | 'order' | 'pileup' | 'capacity';
export type IssueStatus = 'needs_you' | 'watching' | 'fixed';

export interface IssueChoice {
  label: string;
  hint: string;
  /** What running this choice does. */
  run: { kind: 'assign'; moveId: string; personId: string }
    | { kind: 'sequence'; issueId: string }
    | { kind: 'keep'; issueId: string }
    | { kind: 'park'; issueId: string }
    | { kind: 'skip'; issueId: string }
    | { kind: 'reschedule'; moveIds: string[]; days: number }
    | { kind: 'open'; moveId: string };
}

export interface Issue {
  /** Stable key (kind + move ids) so a dismissal survives recompute. */
  id: string;
  kind: IssueKind;
  status: IssueStatus;
  projectId: string;
  moveIds: string[];
  /** Short label for lists ("QA sign-off owner"). */
  label: string;
  /** Card title ("QA sign-off has no owner"). */
  title: string;
  /** TODD, first person. */
  explanation: string;
  /** Review question at 46px. */
  question: string;
  /** Review consequence line. */
  consequence: string;
  choices: IssueChoice[];
  /** Days still, for stalls. */
  days?: number;
}

export type RangeKey = '1w' | '3w' | 'q';

/** One node on a flow track. x is 0..1 across the track. */
export type NodeKind = 'done' | 'upcoming' | 'stalled' | 'gap' | 'order' | 'fixed' | 'pileup';

export interface TrackNode {
  id: string;
  x: number;
  kind: NodeKind;
  label?: string;
  sublabel?: string;
  /** Text inside the node ("6d", "9"). */
  text?: string;
  /** Clicking the node opens this move. */
  moveId?: string;
}

export interface TrackModel {
  nodes: TrackNode[];
  /** x of the today marker, or null when today is outside the range. */
  today: number | null;
  /** Green progress runs 0 -> progress. */
  progress: number;
  /** Dashed stalled segment. */
  stall?: { from: number; to: number };
  ticks?: { x: number; label: string }[];
}
