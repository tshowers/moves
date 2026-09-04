import { Injectable } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';

export type ToddSignalState = 'idle' | 'listening' | 'thinking' | 'ready';

export interface EngagementActionRequest {
  [key: string]: unknown;
}

/**
 * No-op stand-in for the page-context/activity-reporting slice of
 * ToddAssistantBusService, ported from Network's NetworkAssistantSignalService.
 * This app deliberately doesn't carry TODD's full assistant bus (see the
 * assistant-box scoping decision - it's a separate, much bigger project
 * than this extraction), so ported components' calls to report page
 * context, transcript nudges, and activity events have nowhere to go.
 * Kept as a same-shaped no-op rather than deleted from each call site,
 * both to minimize the diff against the original components and because
 * a real Moves-scoped assistant (if/when built) would plug in here.
 *
 * Extended beyond Network's version with `signalState$` and
 * `engagementActionRequest$` - task-home/task-edit/task-view-parent and
 * the moves-pricing/moves-paid-success pages all subscribe to these two
 * observables (Network's ported pages never needed them), so they're
 * included here as inert observables rather than left unimplemented.
 */
@Injectable( { providedIn: 'root' } )
export class MovesAssistantSignalService {
  readonly signalState$: Observable<ToddSignalState> = of( 'idle' );

  private readonly engagementActionRequestSubject = new Subject<EngagementActionRequest>();
  readonly engagementActionRequest$: Observable<EngagementActionRequest> =
    this.engagementActionRequestSubject.asObservable();

  emitAssistantActivity ( _event: Record<string, unknown> ): void { }
  setPageContext ( _context: Record<string, unknown> ): void { }
  clearPageContext (): void { }
  pushTranscript ( _message: { role: string; content: string } ): void { }
  markAssistantUnread (): void { }
  setSignalReady (): void { }
}
