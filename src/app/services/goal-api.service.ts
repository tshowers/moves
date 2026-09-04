import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ToddMissionRecord } from '../models/mission.model';

/**
 * Trimmed from services/goal.service.ts (1500+ lines covering TODD's
 * whole Goal Engine) - just the one call task-view-parent.component.ts
 * makes, getToddMission(), to show its "mission filter active" banner
 * when a Move's project is linked to a strategic mission.
 */
@Injectable( { providedIn: 'root' } )
export class GoalApiService {
  getToddMission ( missionId: string ): Observable<{ success: boolean; data: ToddMissionRecord }> {
    return this.http.get<{ success: boolean; data: ToddMissionRecord }>(
      `${environment.backendURL}/missions/${missionId}`
    );
  }

  constructor ( private http: HttpClient ) { }
}
