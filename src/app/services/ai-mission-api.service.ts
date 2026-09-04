import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AIMission,
  MissionActivityLogEntry,
  CreateAIMissionPayload,
} from '../models/ai-mission.model';

/**
 * Near-verbatim port of services/ai-mission.service.ts (74 lines, pure
 * HttpClient against `${backendURL}/ai-missions`) - only rename is
 * AIMissionService -> AiMissionApiService and the model import path.
 */
@Injectable({ providedIn: 'root' })
export class AiMissionApiService {
  private readonly baseUrl = `${environment.backendURL}/ai-missions`;

  constructor(private http: HttpClient) {}

  createAIMission(payload: CreateAIMissionPayload): Observable<AIMission> {
    return this.http
      .post<{ success: boolean; mission: AIMission }>(this.baseUrl, payload)
      .pipe(map((res) => res.mission));
  }

  listAIMissions(filters?: { status?: string; createdBy?: string }): Observable<AIMission[]> {
    return this.http
      .get<{ success: boolean; missions: AIMission[] }>(this.baseUrl, { params: filters as any })
      .pipe(map((res) => res.missions));
  }

  getAIMission(id: string): Observable<AIMission> {
    return this.http
      .get<{ success: boolean; mission: AIMission }>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.mission));
  }

  runAIMission(id: string): Observable<{ status: string; nextAction?: string }> {
    return this.http
      .post<{ success: boolean; result: any }>(`${this.baseUrl}/${id}/run`, {})
      .pipe(map((res) => res.result));
  }

  approveMissionAction(
    id: string,
    decision: 'approve' | 'reject' | 'pause'
  ): Observable<AIMission> {
    return this.http
      .post<{ success: boolean; mission: AIMission }>(`${this.baseUrl}/${id}/approve`, { decision })
      .pipe(map((res) => res.mission));
  }

  pauseMission(id: string): Observable<AIMission> {
    return this.http
      .post<{ success: boolean; mission: AIMission }>(`${this.baseUrl}/${id}/pause`, {})
      .pipe(map((res) => res.mission));
  }

  completeMission(id: string): Observable<AIMission> {
    return this.http
      .post<{ success: boolean; mission: AIMission }>(`${this.baseUrl}/${id}/complete`, {})
      .pipe(map((res) => res.mission));
  }

  getMissionActivityLog(id: string, limit = 50): Observable<MissionActivityLogEntry[]> {
    return this.http
      .get<{ success: boolean; log: MissionActivityLogEntry[] }>(
        `${this.baseUrl}/${id}/activity`,
        { params: { limit: String(limit) } }
      )
      .pipe(map((res) => res.log));
  }

  getMissionsNeedingApproval(): Observable<AIMission[]> {
    return this.listAIMissions({ status: 'needs_approval' });
  }
}
