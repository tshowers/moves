import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { getAuth } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface StarterMove { key: string; label: string; title: string; }
export interface MoveWhen { key: string; label: string; }
export interface MovePriority { key: string; label: string; }

/** Same starters as moves-ios's StarterMove - one preselected, "Other"
 * types its own. */
export const STARTER_MOVES: StarterMove[] = [
  { key: 'followUp', label: 'Follow up with a lead', title: 'Follow up with a lead' },
  { key: 'proposal', label: 'Send a proposal', title: 'Send a proposal' },
  { key: 'planWeek', label: 'Plan my week', title: 'Plan my week' },
  { key: 'finishProject', label: 'Finish a project', title: 'Finish a project' },
  { key: 'other', label: 'Other', title: '' },
];

export const MOVE_WHEN: MoveWhen[] = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'nextWeek', label: 'Next week' },
];

export const MOVE_PRIORITIES: MovePriority[] = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
  { key: 'urgent', label: 'Urgent' },
];

export interface MovesSignupDraft {
  starterKey: string;
  title: string;
  whenKey: string;
  priority: string;
  firstName: string;
  lastName: string;
  /** Set once the visitor reached the sign-in step; an abandoned draft is never submitted. */
  readyToSubmit: boolean;
}

/** What happened to a pending draft after sign-in. */
export type SignupDraftResult = 'none' | 'saved' | 'needsApp';

/**
 * The pre-sign-in /get-started wizard's draft - the web twin of moves-ios's
 * FirstMoveDraft: a first Move (what, when, how important), then name.
 * Kept in localStorage because sign-in leaves the site for
 * todd.taliferro.tech and comes back to /auth/callback.
 *
 * After sign-in, submitIfPending() saves the name to the TODD profile
 * (POST /api/onboarding/profile, blank fields only) and creates the Move
 * (POST /api/mobile/moves, ID-token auth). Creating a Move needs the Moves
 * app ("browse free, create with the app", Ty 2026-09-28): without it the
 * backend answers 403 APP_PURCHASE_REQUIRED, the draft is kept, and the
 * "get the app" banner shows it waiting - it saves on the next sign-in
 * after the purchase.
 */
@Injectable( { providedIn: 'root' } )
export class MovesSignupDraftService {
  private readonly storageKey = 'moves_signup_draft';

  constructor ( private readonly http: HttpClient ) { }

  fresh (): MovesSignupDraft {
    return {
      starterKey: STARTER_MOVES[0].key,
      title: STARTER_MOVES[0].title,
      whenKey: 'tomorrow',
      priority: 'high',
      firstName: '',
      lastName: '',
      readyToSubmit: false,
    };
  }

  load (): MovesSignupDraft {
    const fresh = this.fresh();
    try {
      const raw = localStorage.getItem( this.storageKey );
      return raw ? { ...fresh, ...JSON.parse( raw ) } : fresh;
    } catch {
      return fresh;
    }
  }

  save ( draft: MovesSignupDraft ): void {
    try { localStorage.setItem( this.storageKey, JSON.stringify( draft ) ); } catch { }
  }

  clear (): void {
    try { localStorage.removeItem( this.storageKey ); } catch { }
  }

  /** The drafted Move, if the visitor finished the wizard and it isn't saved yet. */
  pendingTitle (): string {
    const draft = this.load();
    return draft.readyToSubmit ? draft.title.trim() : '';
  }

  /** End of today, tomorrow, this Friday (today if it's the weekend), or
   * next Monday - worked out at save time, like moves-ios's MoveWhen. */
  dueDate ( whenKey: string, now = new Date() ): Date {
    const day = new Date( now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0 );
    const weekday = day.getDay(); // 0 = Sunday
    let days = 1;
    switch ( whenKey ) {
      case 'today': days = 0; break;
      case 'tomorrow': days = 1; break;
      case 'thisWeek': days = Math.max( 0, 5 - weekday ); break;
      case 'nextWeek': days = ( 8 - weekday ) % 7 || 7; break;
    }
    day.setDate( day.getDate() + days );
    return day;
  }

  /** Never throws. The draft is cleared only once the Move is saved. */
  async submitIfPending (): Promise<SignupDraftResult> {
    const draft = this.load();
    const user = getAuth().currentUser;
    const title = draft.title.trim();
    if ( !draft.readyToSubmit || !user || !title ) return 'none';

    try {
      const headers = { Authorization: `Bearer ${await user.getIdToken()}` };
      await firstValueFrom( this.http.post( `${environment.backendURL}/onboarding/profile`, {
        source: 'moves-web',
        profile: {
          firstName: draft.firstName,
          lastName: draft.lastName,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        },
      }, { headers } ) ).catch( () => undefined );

      await firstValueFrom( this.http.post( `${environment.backendURL}/mobile/moves`, {
        title,
        status: 'not-started',
        priority: draft.priority,
        dueDate: this.dueDate( draft.whenKey ).toISOString(),
      }, { headers } ) );
      this.clear();
      return 'saved';
    } catch ( error ) {
      if ( error instanceof HttpErrorResponse && error.status === 403 ) return 'needsApp';
      console.warn( '[MovesSignupDraftService] saving the sign-up Move failed; will retry next sign-in', error );
      return 'none';
    }
  }
}
