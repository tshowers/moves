/**
 * Trimmed from goal.service.ts's ToddMissionRecord - only the fields
 * task-view-parent.component.ts's mission-filter banner actually reads
 * (title, status, progress.completedCount/totalCount). This is TODD's
 * strategic "Goal Engine" mission concept (project_delivery_outcome, etc.),
 * a different, larger feature than ai-mission.model.ts's AIMission
 * (autonomous task-execution missions) - not part of the Moves extraction,
 * so only trimmed to what the banner needs, not fully ported.
 */
export interface ToddMissionRecord {
  id: string;
  status: string;
  title: string;
  moveCount?: number;
  progress?: {
    totalCount?: number;
    completedCount?: number;
  };
  [key: string]: unknown;
}
