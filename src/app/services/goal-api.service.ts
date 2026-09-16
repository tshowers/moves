import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ToddMissionIntake, ToddMissionRecord } from '../models/mission.model';

/**
 * Ported from services/goal.service.ts (6900+ lines covering TODD's whole
 * Goal Engine) - just the mission-planning slice the Mission Workspace
 * feature needs (plan preview/create/revise/list/get/status), plus the
 * original getToddMission() call task-view-parent.component.ts makes for
 * its "mission filter active" banner. The rest of goal.service.ts (daily
 * revenue goals, Stripe/calendar integrations, strategy requests, etc.)
 * is out of scope - a different part of the Goal Engine, not used here.
 */
@Injectable( { providedIn: 'root' } )
export class GoalApiService {
  constructor ( private http: HttpClient ) { }

  previewToddMissionPlan ( payload: ToddMissionIntake ): Observable<{ success: boolean; data: ToddMissionRecord }> {
    return this.http.post<{ success: boolean; data: ToddMissionRecord }>(
      `${environment.backendURL}/missions/plan`,
      payload
    );
  }

  createToddMission ( payload: ToddMissionIntake ): Observable<{ success: boolean; data: ToddMissionRecord }> {
    return this.http.post<{ success: boolean; data: ToddMissionRecord }>(
      `${environment.backendURL}/missions`,
      payload
    );
  }

  updateToddMission ( missionId: string, payload: Partial<ToddMissionIntake> & { status?: string } ): Observable<{ success: boolean; data: ToddMissionRecord }> {
    return this.http.put<{ success: boolean; data: ToddMissionRecord }>(
      `${environment.backendURL}/missions/${missionId}`,
      payload
    );
  }

  previewToddMissionRevision ( missionId: string, payload: Partial<ToddMissionIntake> ): Observable<{ success: boolean; data: ToddMissionRecord }> {
    return this.http.post<{ success: boolean; data: ToddMissionRecord }>(
      `${environment.backendURL}/missions/${missionId}/revision-preview`,
      payload
    );
  }

  applyToddMissionRevision ( missionId: string, payload: Partial<ToddMissionIntake>, applyNetNewMoves: boolean ): Observable<{ success: boolean; data: ToddMissionRecord }> {
    return this.http.post<{ success: boolean; data: ToddMissionRecord }>(
      `${environment.backendURL}/missions/${missionId}/revisions/apply`,
      { payload, applyNetNewMoves }
    );
  }

  updateToddMissionStatus ( missionId: string, status: string ): Observable<{ success: boolean; data: ToddMissionRecord }> {
    return this.http.post<{ success: boolean; data: ToddMissionRecord }>(
      `${environment.backendURL}/missions/${missionId}/status`,
      { status }
    );
  }

  listToddMissions (): Observable<{ success: boolean; data: ToddMissionRecord[] }> {
    return this.http.get<{ success: boolean; data: ToddMissionRecord[] }>(
      `${environment.backendURL}/missions`
    );
  }

  getToddMission ( missionId: string ): Observable<{ success: boolean; data: ToddMissionRecord }> {
    return this.http.get<{ success: boolean; data: ToddMissionRecord }>(
      `${environment.backendURL}/missions/${missionId}`
    );
  }
}
