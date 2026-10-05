import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

/** Maya's work page, where a job's questions, progress and approvals live. */
export const MAYA_WORK_URL = 'https://maya.taliferro.tech/work';

/**
 * Hands a move to Maya: starts one of her jobs (todd-backend/functions/maya/jobs.routes.js).
 * Starting a job needs the TODD Suite or the Maya app; the backend answers
 * APP_PURCHASE_REQUIRED otherwise. The ID-token interceptor signs the request.
 */
@Injectable( { providedIn: 'root' } )
export class MayaJobsApiService {
  constructor ( private readonly http: HttpClient ) { }

  /** Returns the job's page on Maya's site. */
  async start ( request: string ): Promise<string> {
    const response = await firstValueFrom( this.http.post<{ job: { id: string } }>(
      `${environment.backendURL}/maya/jobs`, { request } ) );
    return `${MAYA_WORK_URL}?job=${encodeURIComponent( response.job.id )}`;
  }
}
