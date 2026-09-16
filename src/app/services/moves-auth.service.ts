import { Injectable } from '@angular/core';
import {
  Auth,
  getAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { Observable, shareReplay, switchMap, of, tap } from 'rxjs';

/**
 * Auth service for the standalone Moves app - line-for-line pattern from
 * Network's NetworkAuthService (the same pattern Pulse and Lead Vault
 * also use). Sign-in itself no longer happens here - it redirects to
 * TODD's hosted login (todd.taliferro.tech/login), the same page
 * network-ios/pulse-ios open via TODDAuthKit's HostedLogin
 * (ASWebAuthenticationSession), so every TODD client presents the
 * identical sign-in screen instead of each maintaining its own copy of
 * Google/Apple/email-link/phone code that can drift out of sync. This
 * service only holds the two things every client still needs locally:
 * completing the redirect back from that page, and tenant/session reads.
 *
 * Mirrors the exact same resolution TODD's own `AuthService` uses
 * (`resolveAssignedTenantId`): `users/{uid}.companyId` if set, else the
 * uid itself is the tenant.
 *
 * Unlike Network/Pulse/Lead-Vault, several components ported into this
 * app (task.component.ts extends TopDogComponent, which is a genuine port
 * of TODD's own base component) were written against TODD's AuthService
 * assuming a *synchronous* `getTenant()` - TODD's tenant.interceptor.ts
 * reads it on every HTTP request, before any Observable could resolve.
 * TODD's real AuthService gets away with this by caching the resolved
 * tenantId in localStorage (`todd_active_tenant_id`) the first time it's
 * resolved, then reading that cache synchronously afterward
 * (`getCachedTenantId`/`cacheTenantId` in auth.service.ts). That caching
 * is reproduced here for the same reason, not present in Network's
 * original service.
 */
@Injectable( { providedIn: 'root' } )
export class MovesAuthService {
  private get auth (): Auth {
    return getAuth();
  }

  private userId$?: Observable<string>;
  private tenantId$?: Observable<string>;

  private readonly pendingLoginStorageKey = 'moves_hosted_login_pending';

  // Same storage key TODD's own AuthService uses - not shared cross-origin
  // (moves.taliferro.tech vs todd.taliferro.tech are different origins),
  // but kept identical in name for consistency/debuggability.
  private readonly tenantStorageKey = 'todd_active_tenant_id';

  getUser (): Observable<User | null> {
    return new Observable( ( subscriber ) => {
      const override = this.getCypressAuthOverride();
      if ( override ) {
        subscriber.next( { uid: override.uid, email: override.email } as User );
        subscriber.complete();
        return;
      }

      const unsubscribe = onAuthStateChanged( this.auth, ( user ) => subscriber.next( user ) );
      return unsubscribe;
    } );
  }

  /** Matches TODD's own AuthService.getUserId() shape - components ported
   * from features/tasks/* call this by name, so keeping the signature
   * identical means the rest of a component's logic ports unchanged. */
  getUserId (): Observable<string> {
    if ( !this.userId$ ) {
      this.userId$ = new Observable<string>( ( subscriber ) => {
        const override = this.getCypressAuthOverride();
        if ( override ) {
          subscriber.next( override.uid );
          subscriber.complete();
          return;
        }

        const unsubscribe = onAuthStateChanged( this.auth, ( user ) => subscriber.next( user?.uid || '' ) );
        return unsubscribe;
      } ).pipe( shareReplay( { bufferSize: 1, refCount: false } ) );
    }
    return this.userId$;
  }

  /** Resolved once per session and shared - every ported component needs
   * this for `tenants/{tenantId}/...` reads, so it's cached here rather
   * than making each component re-resolve it. Also mirrors the resolved
   * value into localStorage so getTenant() can read it synchronously
   * (see class doc comment). */
  getTenantId (): Observable<string> {
    const override = this.getCypressAuthOverride();
    if ( override ) {
      this.cacheTenantId( override.tenantId );
      return of( override.tenantId );
    }

    if ( !this.tenantId$ ) {
      this.tenantId$ = this.getUserId().pipe(
        switchMap( ( uid ) => ( uid ? this.resolveTenantId( uid ) : of( '' ) ) ),
        tap( ( tenantId ) => this.cacheTenantId( tenantId ) ),
        shareReplay( { bufferSize: 1, refCount: false } ),
      );
    }
    return this.tenantId$;
  }

  isLoggedIn (): Observable<boolean> {
    return new Observable( ( subscriber ) => {
      if ( this.getCypressAuthOverride() ) {
        subscriber.next( true );
        subscriber.complete();
        return;
      }

      const unsubscribe = onAuthStateChanged( this.auth, ( user ) => subscriber.next( !!user ) );
      return unsubscribe;
    } );
  }

  getCurrentUserIdSync (): string {
    const override = this.getCypressAuthOverride();
    if ( override ) return override.uid;
    return this.auth.currentUser?.uid || '';
  }

  getCurrentUserEmailSync (): string {
    const override = this.getCypressAuthOverride();
    if ( override ) return override.email || '';
    return this.auth.currentUser?.email || '';
  }

  /** Synchronous tenant read for the tenant.interceptor.ts - mirrors
   * TODD's AuthService.getTenant(): cached value if we have one, else
   * falls back to the raw Firebase uid (matching resolveTenantId's own
   * fallback) so the very first request after sign-in still carries a
   * usable tenant id even before getTenantId()'s Observable has resolved
   * the real companyId. */
  getTenant (): string {
    const override = this.getCypressAuthOverride();
    if ( override ) return override.tenantId;

    const cached = this.getCachedTenantId();
    if ( cached ) return cached;
    return this.auth.currentUser?.uid || '';
  }

  /**
   * Test-only escape hatch used by the Cypress suite (cypress/support/
   * commands.ts's visitWithCypressAuth) to sign in as a fake user without
   * driving Firebase's real hosted-login redirect through
   * todd.taliferro.tech. Gated on `window.Cypress`, which Cypress injects
   * into every page it drives and which is never present in a normal
   * browser session - production and regular dev use are unaffected.
   * Ported from TODD's own AuthService.getCypressAuthOverride().
   */
  private getCypressAuthOverride (): { uid: string; tenantId: string; email: string | null } | null {
    if ( typeof window === 'undefined' || !( window as any ).Cypress ) {
      return null;
    }

    try {
      const raw = window.localStorage.getItem( '__cypressAuthOverride' );
      if ( !raw ) return null;

      const parsed = JSON.parse( raw );
      if ( !parsed || typeof parsed.uid !== 'string' || !parsed.uid.trim() ) {
        return null;
      }

      return {
        uid: parsed.uid.trim(),
        tenantId: typeof parsed.tenantId === 'string' && parsed.tenantId.trim()
          ? parsed.tenantId.trim()
          : parsed.uid.trim(),
        email: typeof parsed.email === 'string' && parsed.email.trim()
          ? parsed.email.trim()
          : null,
      };
    } catch {
      return null;
    }
  }

  private getCachedTenantId (): string {
    try {
      return window.localStorage.getItem( this.tenantStorageKey ) || '';
    } catch {
      return '';
    }
  }

  private cacheTenantId ( tenantId: string | null | undefined ): void {
    try {
      const normalized = String( tenantId || '' ).trim();
      if ( normalized ) {
        window.localStorage.setItem( this.tenantStorageKey, normalized );
      } else {
        window.localStorage.removeItem( this.tenantStorageKey );
      }
    } catch {
      // ignore storage failures (private browsing, etc.)
    }
  }

  /**
   * Leaves the app entirely for TODD's hosted login
   * (todd.taliferro.tech/login?client=moves-web&state=...), the same page
   * every TODD client signs in through. `state` is a random value stashed
   * alongside `returnUrl` in sessionStorage before leaving, and checked
   * again in AuthCallbackComponent when the page sends the user back - a
   * CSRF guard against a forged callback. The backend already has
   * `moves-web` registered in authClients.js with redirectUri
   * `https://moves.taliferro.tech/auth/callback` - no backend change
   * needed here.
   */
  signIn ( returnUrl?: string ): void {
    const state = crypto.randomUUID();
    sessionStorage.setItem( this.pendingLoginStorageKey, JSON.stringify( { state, returnUrl } ) );
    const client = this.isLocalDevelopmentHost() ? 'moves-web-local' : 'moves-web';
    this.navigateToHostedLogin( `https://todd.taliferro.tech/login?client=${client}&state=${state}` );
  }

  /**
   * Split out from signIn() so tests can spy on this instead of the real
   * window.location.href assignment - `location.href` isn't actually
   * configurable in real Chrome (Karma) despite what spyOnProperty
   * expects, and letting this hand-off actually fire in Cypress leaves no
   * stable, reliably-observable state on this origin afterward.
   */
  protected navigateToHostedLogin ( url: string ): void {
    window.location.href = url;
  }

  private isLocalDevelopmentHost (): boolean {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  /**
   * Reads back what signIn() stashed before leaving, verifies the state
   * value matches what the hosted login page is handing back, and clears
   * it either way so a stale/reused entry can't validate a later attempt.
   */
  consumePendingLogin ( state: string | null ): { returnUrl?: string } | null {
    const raw = sessionStorage.getItem( this.pendingLoginStorageKey );
    sessionStorage.removeItem( this.pendingLoginStorageKey );
    if ( !raw ) return null;

    try {
      const pending = JSON.parse( raw ) as { state: string; returnUrl?: string };
      if ( !state || pending.state !== state ) return null;
      return { returnUrl: pending.returnUrl };
    } catch {
      return null;
    }
  }

  /** Redeems the custom token AuthCallbackComponent received from the hosted login page. */
  async signInWithCustomToken ( token: string ): Promise<User> {
    const result = await signInWithCustomToken( this.auth, token );
    return result.user;
  }

  async signOut (): Promise<void> {
    this.cacheTenantId( null );
    await signOut( this.auth );
  }

  /**
   * Same rule as `users.service.ts`'s `getTenantLoggedInContactInfo` /
   * TODD's own AuthService.resolveAssignedTenantId - not a guess.
   */
  async resolveTenantId ( uid: string ): Promise<string> {
    const snap = await getDoc( doc( getFirestore(), 'users', uid ) );
    const companyId = String( ( snap.data() as any )?.companyId || '' ).trim();
    return companyId || uid;
  }
}
