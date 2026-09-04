import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

/**
 * No-op stand-in for TODD's SettingsService (302 lines, heavily coupled
 * to DataService for per-user preference documents). TopDogComponent
 * (which task.component.ts extends) injects it as a constructor
 * dependency, but nothing in the components ported into this app - task,
 * task-view-parent, task-home, task-edit, ai-mission-list/detail - ever
 * calls a method on it; it's carried purely so TopDogComponent's own
 * constructor signature is satisfiable. If Moves ever needs real
 * per-user settings, this is where to build it, following
 * MovesDataService's direct-Firestore pattern.
 */
@Injectable( { providedIn: 'root' } )
export class MovesSettingsService {
  readonly settings$: Observable<any> = of( {} );

  getSettings (): any {
    return {};
  }

  isGoogleCloudDown (): boolean {
    return false;
  }
}
