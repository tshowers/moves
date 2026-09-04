import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { initializeApp } from 'firebase/app';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { tenantInterceptor } from './core/interceptors/tenant.interceptor';

initializeApp( environment.firebaseConfig );

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // Mirrors TODD's own core/interceptors/tenant.interceptor.ts - every
    // ported service (TaskApiService, AiMissionApiService, GoalApiService,
    // MovesEmailService...) was written against the monorepo's HttpClient
    // expecting X-Tenant-Id/X-User-Id/X-User-Email to already be on the
    // request, not against manually-built headers per call. Registering
    // the same interceptor here keeps those services a near-verbatim port
    // instead of hand-editing headers into every call site.
    provideHttpClient(withInterceptors([tenantInterceptor])),
  ]
};
