/** Ported verbatim from shared/data/interfaces/ai-mission.model.ts - a
 * pure model file with no service coupling. */
export type MissionStatus =
  | 'draft'
  | 'active'
  | 'waiting'
  | 'blocked'
  | 'needs_approval'
  | 'completed'
  | 'failed';

export type MissionPriority = 'low' | 'medium' | 'high';

export type MissionStepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';

export type MissionArtifactType = 'document' | 'survey' | 'email_draft' | 'proposal' | 'contact_list';

export type MissionActivityActor = 'todd' | 'user' | 'system';

export type MissionActivityActionType =
  | 'plan_generated'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'approval_request'
  | 'approval_granted'
  | 'approval_rejected'
  | 'artifact_created'
  | 'external_action'
  | 'blocked'
  | 'completed';

export interface MissionStep {
  id: string;
  stepNumber: number;
  description: string;
  capability: string;
  requiresApproval: boolean;
  status: MissionStepStatus;
  result?: string | null;
  completedAt?: string | null;
}

export interface ResearchNote {
  id: string;
  content: string;
  source: 'openai' | 'hunter' | 'document' | 'user';
  createdAt: string;
}

export interface MissionArtifact {
  id: string;
  type: MissionArtifactType;
  title: string;
  referenceId?: string;
  status: 'draft' | 'approved' | 'published';
  createdAt: string;
  content?: Record<string, unknown>;
}

export interface PendingApprovalAction {
  stepId: string;
  capability: string;
  summary: string;
  data: Record<string, unknown>;
  requestedAt: string;
}

export interface AIMission {
  id: string;
  tenantId: string;
  createdBy: string;

  title: string;
  objective: string;
  successCriteria: string;
  missionContext: Record<string, unknown>;
  priority: MissionPriority;
  deadline?: string | null;

  status: MissionStatus;
  missionPlan: MissionStep[];
  currentStepIndex: number;
  researchNotes: ResearchNote[];
  artifacts: MissionArtifact[];
  nextAction: string;
  escalationReason: string;

  approvalRequired: boolean;
  pendingApprovalAction?: PendingApprovalAction | null;

  createdAt: string;
  updatedAt: string;
}

export interface MissionActivityLogEntry {
  id: string;
  missionId: string;
  tenantId: string;
  actor: MissionActivityActor;
  actionType: MissionActivityActionType;
  summary: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface CreateAIMissionPayload {
  title: string;
  objective: string;
  successCriteria?: string;
  missionContext?: Record<string, unknown>;
  priority?: MissionPriority;
  deadline?: string;
}
