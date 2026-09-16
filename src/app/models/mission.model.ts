/**
 * Ported from goal.service.ts's ToddMissionType/ToddMissionIntake/
 * ToddMissionMove/ToddMissionRecord - TODD's strategic "Goal Engine"
 * mission concept (project_delivery_outcome, etc.), used by the Mission
 * Workspace feature (plan generation, revision, approval). A different,
 * larger concept than ai-mission.model.ts's AIMission (autonomous
 * task-execution missions).
 */
export type ToddMissionType =
  | 'daily_revenue_outcome'
  | 'project_delivery_outcome'
  | 'campaign_execution_outcome'
  | 'client_success_outcome';

export type ToddMissionIntake = {
  title?: string;
  missionType: ToddMissionType;
  problemStatement: string;
  desiredOutcome: string;
  companyDescription?: string;
  mission?: string;
  valueProposition?: string;
  resources?: string[];
  stakeholders?: string[];
  constraints?: string[];
  timeline?: string;
  successCriteria?: string[];
};

export type ToddMissionMove = {
  id: string;
  title: string;
  status: string;
  priority: string;
  phase?: string;
  route?: string;
  superseded?: boolean;
  supersededAt?: string;
  supersededReason?: string;
};

export type ToddMissionRecord = {
  id: string;
  missionType: ToddMissionType;
  status: string;
  title: string;
  moveCount?: number;
  createdAt?: string;
  updatedAt?: string;
  intake?: ToddMissionIntake;
  plan?: {
    projectSummary?: string;
    successCriteria?: string[];
    milestones?: Array<{
      id?: string;
      title?: string;
      objective?: string;
      deliverables?: string[];
    }>;
    taskPlan?: Array<{
      title?: string;
      description?: string;
      phase?: string;
      priority?: string;
    }>;
    blockerAssumptions?: string[];
    nextRecommendedMove?: {
      label?: string;
      description?: string;
    };
  };
  moves?: ToddMissionMove[];
  progress?: {
    totalCount?: number;
    openCount?: number;
    completedCount?: number;
    blockedCount?: number;
    inProgressCount?: number;
    overdueCount?: number;
    completionPercent?: number;
  };
  health?: {
    totalCount?: number;
    openCount?: number;
    blockedCount?: number;
    completedCount?: number;
    overdueCount?: number;
    completionPercent?: number;
    currentRiskLevel?: string;
    topRisk?: string;
  };
  drift?: {
    label?: string;
    explanation?: string;
    signals?: string[];
  };
  risks?: string[];
  revision?: {
    createdAt?: string;
    summary?: {
      before?: string;
      after?: string;
      changed?: boolean;
    };
    successCriteria?: {
      unchanged?: string[];
      added?: string[];
      removed?: string[];
    };
    milestones?: {
      unchanged?: Array<{ id?: string; title?: string; objective?: string; deliverables?: string[]; }>;
      modified?: Array<{
        before?: { id?: string; title?: string; objective?: string; deliverables?: string[]; };
        after?: { id?: string; title?: string; objective?: string; deliverables?: string[]; };
      }>;
      added?: Array<{ id?: string; title?: string; objective?: string; deliverables?: string[]; }>;
      removed?: Array<{ id?: string; title?: string; objective?: string; deliverables?: string[]; }>;
    };
    blockerAssumptions?: {
      unchanged?: string[];
      added?: string[];
      removed?: string[];
    };
    taskChanges?: {
      unchanged?: Array<{ title?: string; description?: string; phase?: string; priority?: string; }>;
      added?: Array<{ title?: string; description?: string; phase?: string; priority?: string; alreadyExistsAsMove?: boolean; relatedMoveId?: string; relatedMoveTitle?: string; }>;
      modified?: Array<{
        before?: { title?: string; description?: string; phase?: string; priority?: string; };
        after?: { title?: string; description?: string; phase?: string; priority?: string; };
        alreadyExistsAsMove?: boolean;
        relatedMoveId?: string;
        relatedMoveTitle?: string;
      }>;
      removed?: Array<{ title?: string; description?: string; phase?: string; priority?: string; relatedMoveId?: string; relatedMoveTitle?: string; relatedMoveSuperseded?: boolean; }>;
    };
    nextRecommendedMove?: {
      before?: { label?: string; description?: string; };
      after?: { label?: string; description?: string; };
      changed?: boolean;
    };
    newTaskCount?: number;
    changedTaskCount?: number;
    removedTaskCount?: number;
    unchangedTaskCount?: number;
    appliedNetNewMoves?: boolean;
    appliedMoveIds?: string[];
  };
  revisions?: Array<{
    createdAt?: string;
    summary?: {
      before?: string;
      after?: string;
      changed?: boolean;
    };
    newTaskCount?: number;
    changedTaskCount?: number;
    removedTaskCount?: number;
    unchangedTaskCount?: number;
    appliedNetNewMoves?: boolean;
    appliedMoveIds?: string[];
    nextRecommendedMove?: {
      before?: { label?: string; description?: string; };
      after?: { label?: string; description?: string; };
      changed?: boolean;
    };
  }>;
  latestRevision?: {
    createdAt?: string;
    summary?: {
      before?: string;
      after?: string;
      changed?: boolean;
    };
    newTaskCount?: number;
    changedTaskCount?: number;
    removedTaskCount?: number;
    unchangedTaskCount?: number;
    appliedNetNewMoves?: boolean;
    appliedMoveIds?: string[];
  };
  communicationDrafts?: {
    stakeholderStatusUpdate?: string;
    blockerEscalationUpdate?: string;
    decisionRequestUpdate?: string;
    progressSummaryNote?: string;
  };
  communicationNotes?: Array<{
    id?: string;
    draftType?: string;
    title?: string;
    body?: string;
    audienceLabel?: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
  statusUpdateDraft?: string;
};
