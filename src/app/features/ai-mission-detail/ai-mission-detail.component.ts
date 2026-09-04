import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { AIMission, MissionActivityLogEntry, MissionStep } from '../../models/ai-mission.model';
import { AiMissionApiService } from '../../services/ai-mission-api.service';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { StatusLedComponent, StatusLedTone } from '../../shared/status-led/status-led.component';

/**
 * Near-verbatim port of features/tasks/ai-mission-detail/ai-mission-detail.component.ts.
 * `artifactLink()` still points at `/survey-view` (Pulse) and
 * `/document-editor` (Docs) - both sibling modules being extracted
 * separately, not part of this app. Left as-is rather than special-cased:
 * same "no action needed" cross-module posture as the brief's note on
 * TaskService/Task being shared with TODD's Today dashboard - if clicked
 * here it lands on this app's not-found page rather than a page that
 * doesn't exist, which is the correct degradation until/unless a cross-
 * app deep-link convention exists.
 */
@Component({
  selector: 'app-ai-mission-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, StatusLedComponent, PreloaderComponent],
  templateUrl: './ai-mission-detail.component.html',
  styleUrl: './ai-mission-detail.component.css',
})
export class AiMissionDetailComponent implements OnInit, OnDestroy {
  mission: AIMission | null = null;
  activityLog: MissionActivityLogEntry[] = [];
  isLoading = true;
  isApproving = false;
  isRunning = false;
  approvalState: 'success' | 'error' | '' = '';
  approvalMessage = '';

  private subs = new Subscription();
  private destroyed = false;
  private readonly maxAutoSteps = 25;
  private readonly stepDelayMs = 1200;

  constructor(
    private route: ActivatedRoute,
    private missionService: AiMissionApiService
  ) {}

  ngOnInit(): void {
    const missionId = this.route.snapshot.paramMap.get('id');
    if (missionId) {
      this.loadMission(missionId);
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.destroyed = true;
  }

  loadMission(id: string): void {
    this.isLoading = true;
    this.subs.add(
      this.missionService.getAIMission(id).subscribe({
        next: (m) => {
          this.mission = m;
          this.isLoading = false;
          this.loadActivityLog(id);
        },
        error: () => { this.isLoading = false; },
      })
    );
  }

  loadActivityLog(id: string): void {
    this.subs.add(
      this.missionService.getMissionActivityLog(id).subscribe({
        next: (log) => { this.activityLog = log; },
      })
    );
  }

  get statusTone(): StatusLedTone {
    const toneMap: Record<string, StatusLedTone> = {
      draft: 'idle',
      active: 'positive',
      waiting: 'idle',
      blocked: 'warn',
      needs_approval: 'attention',
      completed: 'info',
      failed: 'warn',
    };
    return (this.mission && toneMap[this.mission.status]) || 'idle';
  }

  get completedSteps(): number {
    return (this.mission?.missionPlan || []).filter((s) => s.status === 'completed').length;
  }

  stepIcon(step: MissionStep): string {
    const icons: Record<string, string> = {
      completed: '✓',
      in_progress: '⟳',
      failed: '✗',
      skipped: '−',
      pending: '○',
    };
    return icons[step.status] ?? '○';
  }

  actorLabel(actor: string): string {
    const labels: Record<string, string> = {todd: 'TODD', user: 'You', system: 'System'};
    return labels[actor] ?? actor;
  }

  artifactLink(artifact: { type: string; referenceId?: string }): string[] | null {
    if (!artifact.referenceId) return null;
    if (artifact.type === 'survey') return ['/survey-view', artifact.referenceId];
    if (artifact.type === 'document' || artifact.type === 'proposal') {
      return ['/document-editor', artifact.referenceId];
    }
    return null;
  }

  // The backend advances one mission step per /run call (each step can involve
  // an LLM call and needs to stay well under the API's request timeout), so
  // this keeps calling it and refreshing state until the mission stops being
  // actively runnable (needs approval, blocked, completed, or paused).
  async runMission(): Promise<void> {
    if (!this.mission || this.isRunning) return;
    this.isRunning = true;
    const missionId = this.mission.id;

    try {
      for (let i = 0; i < this.maxAutoSteps && !this.destroyed; i++) {
        const result = await firstValueFrom(this.missionService.runAIMission(missionId));
        if (this.destroyed) return;

        const updated = await firstValueFrom(this.missionService.getAIMission(missionId));
        if (this.destroyed) return;

        this.mission = updated;
        this.loadActivityLog(missionId);

        const skipped = !!(result && (result as { skipped?: boolean }).skipped);
        if (skipped || updated.status !== 'active') {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, this.stepDelayMs));
      }
    } catch {
      // Leave the mission at its last known state; the user can retry the run.
    } finally {
      if (!this.destroyed) this.isRunning = false;
    }
  }

  approveMissionAction(decision: 'approve' | 'reject' | 'pause'): void {
    if (!this.mission || this.isApproving) return;
    this.isApproving = true;
    this.approvalState = '';
    this.approvalMessage = '';

    this.subs.add(
      this.missionService.approveMissionAction(this.mission.id, decision).subscribe({
        next: (updated) => {
          this.mission = updated;
          this.isApproving = false;
          this.approvalState = 'success';
          this.approvalMessage =
            decision === 'approve' ? 'Approved. TODD is continuing the mission.' :
            decision === 'reject'  ? 'Step rejected. TODD will move to the next step.' :
            'Mission paused.';
          this.loadActivityLog(updated.id);
        },
        error: (err) => {
          this.isApproving = false;
          this.approvalState = 'error';
          this.approvalMessage = err?.error?.message || 'Something went wrong. Please try again.';
        },
      })
    );
  }
}
