import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { Task } from '../models/task.model';
import { TaskApiService } from '../services/task-api.service';
import { MoveChange, ToddAction } from './flow.models';

export interface ServerRule { id: string; enabled: boolean; locked: boolean }
export interface ServerDismissal { reason: 'keep' | 'skip' | 'park'; until?: string | null }
export interface ServerProject { id: string; name: string; shipsOn: string; client: string; value: string; phases: string[]; memberIds: string[]; leadId: string }

export interface ServerFlowState {
  actions: ToddAction[];
  rules: ServerRule[];
  dismissed: Record<string, ServerDismissal>;
  capacity: Record<string, number>;
  projects: ServerProject[];
  imported: boolean;
}

export interface ActionRequest {
  type: ToddAction['type'];
  moveId: string;
  projectId: string;
  subject: string;
  text: string;
  note?: string;
  title?: string;
  reason: string;
  changes: { moveId: string; after: MoveChange['after'] }[];
}

/**
 * /api/moves/flow (todd-backend moves/flow.service.js): TODD's log with
 * server-side Undo, rule switches, dismissed issues, per-person capacity and
 * project details. Moves themselves still go through TaskApiService.
 */
@Injectable( { providedIn: 'root' } )
export class FlowApiService {
  private readonly http = inject( HttpClient );
  private readonly tasks = inject( TaskApiService );
  private readonly base = `${environment.backendURL}/moves/flow`;

  state (): Promise<ServerFlowState> {
    return firstValueFrom( this.http.get<ServerFlowState>( this.base ) );
  }

  async record ( body: ActionRequest ): Promise<{ action: ToddAction; tasks: Task[] }> {
    const res = await firstValueFrom( this.http.post<{ action: ToddAction; tasks: unknown[] }>( `${this.base}/actions`, body ) );
    return { action: res.action, tasks: res.tasks.map( row => this.tasks.toTask( row ) ) };
  }

  async undo ( actionId: string ): Promise<{ action: ToddAction; tasks: Task[] }> {
    const res = await firstValueFrom( this.http.post<{ action: ToddAction; tasks: unknown[] }>( `${this.base}/actions/${encodeURIComponent( actionId )}/undo`, {} ) );
    return { action: res.action, tasks: res.tasks.map( row => this.tasks.toTask( row ) ) };
  }

  setRule ( ruleId: string, enabled: boolean ): Promise<unknown> {
    return firstValueFrom( this.http.put( `${this.base}/rules/${encodeURIComponent( ruleId )}`, { enabled } ) );
  }

  dismiss ( issueId: string, reason: ServerDismissal['reason'], until?: string ): Promise<unknown> {
    return firstValueFrom( this.http.post( `${this.base}/dismissed`, { issueId, reason, until: until || null } ) );
  }

  undismiss ( issueId: string ): Promise<unknown> {
    return firstValueFrom( this.http.delete( `${this.base}/dismissed/${encodeURIComponent( issueId )}` ) );
  }

  setCapacity ( personId: string, capacity: number ): Promise<unknown> {
    return firstValueFrom( this.http.put( `${this.base}/people/${encodeURIComponent( personId )}/capacity`, { capacity } ) );
  }

  updateProject ( projectId: string, body: Partial<Omit<ServerProject, 'id' | 'name'>> ): Promise<unknown> {
    return firstValueFrom( this.http.put( `${this.base}/projects/${encodeURIComponent( projectId )}`, body ) );
  }

  importLocal ( body: unknown ): Promise<unknown> {
    return firstValueFrom( this.http.post( `${this.base}/import`, body ) );
  }

  /** The server's message for a failed call ("QA sign-off changed since…"), or a plain fallback. */
  static message ( err: unknown, fallback: string ): string {
    const e = err as HttpErrorResponse;
    const msg = e?.error && typeof e.error === 'object' ? ( e.error as { message?: string } ).message : '';
    return e?.status && e.status < 500 && msg ? msg : fallback;
  }
}
