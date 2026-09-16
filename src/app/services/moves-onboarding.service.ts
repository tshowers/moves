import { Injectable } from '@angular/core';

/**
 * Scoped port of services/todd-onboarding.service.ts (515 lines covering
 * TODD's whole cross-product "first visit" intent overlay - which
 * product to try first, route suppression lists for every other TODD
 * product, daily overlay display caps, etc.). None of that UI exists in
 * Moves. This keeps only the "first win" tracking mission-workspace
 * actually calls (completeFirstWin(), after a guided user generates
 * their first mission plan), implemented for real against the same
 * localStorage-backed state shape TODD uses - not a no-op stub.
 */
export type ToddFirstIntent = 'profile' | 'outreach' | 'project' | 'contacts' | 'analyze' | 'not-sure';

export type ToddOnboardingContext = {
  userId: string;
  tenantId?: string | null;
};

type MovesOnboardingState = {
  version: number;
  selectedIntent: ToddFirstIntent | null;
  completedAtIso: string | null;
  firstWinCompletedByIntent: Partial<Record<ToddFirstIntent, string>>;
};

@Injectable( { providedIn: 'root' } )
export class MovesOnboardingService {
  private readonly version = 1;
  private readonly persistentPrefix = 'moves_onboarding_state';
  private readonly sessionPrefix = 'moves_onboarding_guided_session';

  completeFirstWin ( context: ToddOnboardingContext, intent: ToddFirstIntent ): void {
    const state = this.readState( context );
    const nowIso = new Date().toISOString();
    state.selectedIntent = intent;
    state.firstWinCompletedByIntent[intent] = state.firstWinCompletedByIntent[intent] || nowIso;
    state.completedAtIso = state.completedAtIso || nowIso;
    this.writeState( context, state );
    this.clearGuidedSession( context );
  }

  hasCompletedFirstWin ( context: ToddOnboardingContext, intent: ToddFirstIntent ): boolean {
    return !!this.readState( context ).firstWinCompletedByIntent[intent];
  }

  clearGuidedSession ( context: ToddOnboardingContext ): void {
    this.remove( this.getSessionKey( context ), true );
  }

  private readState ( context: ToddOnboardingContext ): MovesOnboardingState {
    const raw = this.read( this.getPersistentKey( context ) );
    if ( !raw ) {
      return this.createDefaultState();
    }

    try {
      const parsed = JSON.parse( raw ) as Partial<MovesOnboardingState>;
      if ( parsed?.version !== this.version ) {
        return this.createDefaultState();
      }

      return {
        version: this.version,
        selectedIntent: this.isIntent( parsed.selectedIntent ?? null ) ? parsed.selectedIntent! : null,
        completedAtIso: parsed.completedAtIso || null,
        firstWinCompletedByIntent: parsed.firstWinCompletedByIntent || {}
      };
    } catch {
      return this.createDefaultState();
    }
  }

  private writeState ( context: ToddOnboardingContext, state: MovesOnboardingState ): void {
    this.write( this.getPersistentKey( context ), JSON.stringify( state ) );
  }

  private getPersistentKey ( context: ToddOnboardingContext ): string {
    return `${this.persistentPrefix}:${context.tenantId || 'default'}:${context.userId}`;
  }

  private getSessionKey ( context: ToddOnboardingContext ): string {
    return `${this.sessionPrefix}:${context.tenantId || 'default'}:${context.userId}`;
  }

  private createDefaultState (): MovesOnboardingState {
    return {
      version: this.version,
      selectedIntent: null,
      completedAtIso: null,
      firstWinCompletedByIntent: {}
    };
  }

  private isIntent ( value: string | null ): value is ToddFirstIntent {
    return value === 'profile'
      || value === 'outreach'
      || value === 'project'
      || value === 'contacts'
      || value === 'analyze'
      || value === 'not-sure';
  }

  private read ( key: string, useSessionStorage = false ): string | null {
    if ( !this.isBrowser() ) {
      return null;
    }

    try {
      const storage = useSessionStorage ? window.sessionStorage : window.localStorage;
      return storage.getItem( key );
    } catch {
      return null;
    }
  }

  private write ( key: string, value: string, useSessionStorage = false ): void {
    if ( !this.isBrowser() ) {
      return;
    }

    try {
      const storage = useSessionStorage ? window.sessionStorage : window.localStorage;
      storage.setItem( key, value );
    } catch {
      // Ignore storage failures and keep onboarding non-blocking.
    }
  }

  private remove ( key: string, useSessionStorage = false ): void {
    if ( !this.isBrowser() ) {
      return;
    }

    try {
      const storage = useSessionStorage ? window.sessionStorage : window.localStorage;
      storage.removeItem( key );
    } catch {
      // Ignore storage failures.
    }
  }

  private isBrowser (): boolean {
    return typeof window !== 'undefined'
      && typeof window.localStorage !== 'undefined'
      && typeof window.sessionStorage !== 'undefined';
  }
}
