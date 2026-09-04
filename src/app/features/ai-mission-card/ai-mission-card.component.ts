import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AIMission, MissionStatus } from '../../models/ai-mission.model';
import { StatusLedComponent, StatusLedTone } from '../../shared/status-led/status-led.component';

/** Verbatim port of features/tasks/ai-mission-card/ai-mission-card.component.ts. */
@Component({
  selector: 'app-ai-mission-card',
  standalone: true,
  imports: [CommonModule, RouterModule, StatusLedComponent],
  templateUrl: './ai-mission-card.component.html',
  styleUrl: './ai-mission-card.component.css',
})
export class AiMissionCardComponent {
  @Input() mission!: AIMission;
  @Output() viewDetail = new EventEmitter<string>();
  @Output() approve = new EventEmitter<string>();

  get statusTone(): StatusLedTone {
    const map: Record<MissionStatus, StatusLedTone> = {
      draft: 'idle',
      active: 'positive',
      waiting: 'idle',
      blocked: 'warn',
      needs_approval: 'attention',
      completed: 'info',
      failed: 'warn',
    };
    return map[this.mission?.status] ?? 'idle';
  }

  get statusLabel(): string {
    const map: Record<MissionStatus, string> = {
      draft: 'Draft',
      active: 'Active',
      waiting: 'Waiting',
      blocked: 'Blocked',
      needs_approval: 'Needs Approval',
      completed: 'Completed',
      failed: 'Failed',
    };
    return map[this.mission?.status] ?? this.mission?.status;
  }

  get completedSteps(): number {
    return (this.mission?.missionPlan || []).filter((s) => s.status === 'completed').length;
  }

  get totalSteps(): number {
    return (this.mission?.missionPlan || []).length;
  }

  get artifactCount(): number {
    return (this.mission?.artifacts || []).length;
  }

  onView(): void {
    this.viewDetail.emit(this.mission.id);
  }

  onApprove(): void {
    this.approve.emit(this.mission.id);
  }
}
