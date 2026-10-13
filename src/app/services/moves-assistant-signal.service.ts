import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';

export type ToddSignalState = 'idle' | 'listening' | 'thinking' | 'ready';

export interface EngagementActionRequest {
  [key: string]: unknown;
}

export interface MovesAssistantPageContext {
  feature: string;
  page: string;
  route?: string;
  mode?: string;
  title?: string;
  description?: string;
  allowedActions?: string[];
  selectedEntityType?: string;
  selectedEntityId?: string;
  summary?: Record<string, any>;
  dataPreview?: Record<string, any>;
}

export interface MovesAssistantActivityEvent {
  feature: string;
  page: string;
  action: string;
  route?: string;
  mode?: string;
  summary?: Record<string, any>;
  meta?: Record<string, any>;
}

export interface MovesAssistantTranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * The page-context bus between Moves' screens and TODD's assistant - same
 * pattern as web-products/pulse's PulseAssistantSignalService. The flow map
 * publishes here from FlowRootComponent (flow-assistant-context.ts).
 * `signalState$` and `engagementActionRequest$` stay as they were in the
 * no-op stub (always idle, never emits): nothing renders signalState$, and
 * wiring engagementActionRequest$ would mean pulling in the suite-wide
 * engagement-decision engine this scoping decision keeps out. Everything else
 * (pageContext$/transcriptIn$/unread$) is the same real bus pattern as
 * Network's and Pulse's signal services.
 */
@Injectable( { providedIn: 'root' } )
export class MovesAssistantSignalService {
  /** Always idle - matches the stub this replaces; nothing renders it. */
  readonly signalState$: Observable<ToddSignalState> = of( 'idle' );

  /** Never emits - matches the stub this replaces; no engagement-decision engine here. */
  private readonly engagementActionRequestSubject = new Subject<EngagementActionRequest>();
  readonly engagementActionRequest$: Observable<EngagementActionRequest> =
    this.engagementActionRequestSubject.asObservable();

  private readonly pageContextSubject = new BehaviorSubject<MovesAssistantPageContext | null>( null );
  private readonly transcriptInSubject = new Subject<MovesAssistantTranscriptMessage>();
  private readonly activitySubject = new Subject<MovesAssistantActivityEvent>();
  private readonly unreadSubject = new BehaviorSubject<boolean>( false );
  private readonly readySubject = new BehaviorSubject<boolean>( false );

  readonly pageContext$ = this.pageContextSubject.asObservable();
  readonly transcriptIn$ = this.transcriptInSubject.asObservable();
  readonly activity$ = this.activitySubject.asObservable();
  readonly unread$ = this.unreadSubject.asObservable();
  readonly ready$ = this.readySubject.asObservable();

  get currentPageContext (): MovesAssistantPageContext | null {
    return this.pageContextSubject.value;
  }

  emitAssistantActivity ( event: MovesAssistantActivityEvent ): void {
    this.activitySubject.next( event );
  }

  setPageContext ( context: MovesAssistantPageContext ): void {
    this.pageContextSubject.next( context );
  }

  clearPageContext (): void {
    this.pageContextSubject.next( null );
  }

  pushTranscript ( message: MovesAssistantTranscriptMessage ): void {
    this.transcriptInSubject.next( message );
  }

  markAssistantUnread (): void {
    this.unreadSubject.next( true );
  }

  clearAssistantUnread (): void {
    this.unreadSubject.next( false );
  }

  setSignalReady (): void {
    this.readySubject.next( true );
  }
}
