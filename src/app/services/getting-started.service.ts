import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getAuth } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GettingStartedStep {
  id: 'profile' | 'firstMove' | 'completeMove' | 'mission' | string;
  title: string;
  detail: string;
  done: boolean;
}

export interface GettingStarted {
  steps: GettingStartedStep[];
  completedSteps: number;
  totalSteps: number;
  allDone: boolean;
}

/**
 * Moves' Getting Started checklist (`GET /api/getting-started/moves`) -
 * profile, a first Move, a Move finished, a mission plan - the same data moves-ios shows. On the Help
 * page, and opened after sign-in while steps remain. Mirrors Docs web's
 * getting-started.service.ts.
 */
@Injectable( { providedIn: 'root' } )
export class GettingStartedService {
  private readonly showAfterSignInKey = 'moves_getting_started_show_after_sign_in';
  private readonly shownThisSessionKey = 'moves_getting_started_shown';

  constructor ( private readonly http: HttpClient ) { }

  async load (): Promise<GettingStarted | null> {
    const user = getAuth().currentUser;
    if ( !user ) return null;
    const response = await firstValueFrom( this.http.get<{ data: GettingStarted }>(
      `${environment.backendURL}/getting-started/moves`,
      { headers: { Authorization: `Bearer ${await user.getIdToken()}` } },
    ) );
    return response.data;
  }

  get showAfterSignIn (): boolean {
    try { return localStorage.getItem( this.showAfterSignInKey ) !== 'false'; } catch { return true; }
  }

  set showAfterSignIn ( value: boolean ) {
    try { localStorage.setItem( this.showAfterSignInKey, String( value ) ); } catch { }
  }

  /** True at most once per browser session while steps remain. Never throws. */
  async shouldShowAfterSignIn (): Promise<boolean> {
    try {
      if ( !this.showAfterSignIn || sessionStorage.getItem( this.shownThisSessionKey ) ) return false;
      const progress = await this.load();
      if ( !progress || progress.allDone ) return false;
      sessionStorage.setItem( this.shownThisSessionKey, '1' );
      return true;
    } catch {
      return false;
    }
  }

  routeFor ( step: GettingStartedStep ): string {
    switch ( step.id ) {
      case 'profile': return '/profile';
      case 'firstMove': return step.done ? '/moves-view' : '/move';
      case 'completeMove': return '/moves-view';
      default: return '/plan';
    }
  }

  actionFor ( step: GettingStartedStep ): string {
    switch ( step.id ) {
      case 'profile': return step.done ? 'View profile' : 'Complete profile';
      case 'firstMove': return step.done ? 'View Moves' : 'Create a Move';
      case 'completeMove': return 'Open your Moves';
      default: return step.done ? 'View missions' : 'Plan a mission';
    }
  }
}
