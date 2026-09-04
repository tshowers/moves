import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AIMission, MissionStatus } from '../../models/ai-mission.model';
import { AiMissionApiService } from '../../services/ai-mission-api.service';
import { AiMissionCardComponent } from '../ai-mission-card/ai-mission-card.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';

type StatusFilter = 'all' | MissionStatus;

/** Verbatim port of features/tasks/ai-mission-list/ai-mission-list.component.ts. */
@Component({
  selector: 'app-ai-mission-list',
  standalone: true,
  imports: [CommonModule, RouterModule, AiMissionCardComponent, PreloaderComponent],
  templateUrl: './ai-mission-list.component.html',
  styleUrl: './ai-mission-list.component.css',
})
export class AiMissionListComponent implements OnInit, OnDestroy {
  missions: AIMission[] = [];
  isLoading = true;
  activeFilter: StatusFilter = 'all';

  readonly filters: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Needs Approval', value: 'needs_approval' },
    { label: 'Waiting', value: 'waiting' },
    { label: 'Completed', value: 'completed' },
  ];

  private subs = new Subscription();

  constructor(
    private missionService: AiMissionApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadMissions();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadMissions(): void {
    this.isLoading = true;
    const params = this.activeFilter !== 'all' ? { status: this.activeFilter } : {};
    this.subs.add(
      this.missionService.listAIMissions(params).subscribe({
        next: (missions) => {
          this.missions = missions;
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; },
      })
    );
  }

  setFilter(filter: StatusFilter): void {
    this.activeFilter = filter;
    this.loadMissions();
  }

  get filteredMissions(): AIMission[] {
    return this.missions;
  }

  get approvalCount(): number {
    return this.missions.filter((m) => m.status === 'needs_approval').length;
  }

  onViewDetail(missionId: string): void {
    this.router.navigate(['/move', missionId, 'mission']);
  }

  onApprove(missionId: string): void {
    this.router.navigate(['/move', missionId, 'mission']);
  }

  createMission(): void {
    this.router.navigate(['/move'], { queryParams: { assignToTodd: 'true' } });
  }
}
