import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MovesAuthService } from '../../services/moves-auth.service';
import { MovesSignupDraftService } from '../../services/moves-signup-draft.service';
import { GettingStartedService } from '../../services/getting-started.service';
import { WriteAccessService } from '../../services/write-access.service';

/**
 * Lands here after TODD's hosted login (todd.taliferro.tech/login) hands
 * a signed-in session back to this app: ?token=<custom token>&state=<...>.
 * Verifies `state` against what signIn() stashed before leaving (a forged
 * or replayed callback won't have a matching sessionStorage entry),
 * redeems the token, then continues to wherever the user was headed.
 *
 * Line-for-line copy of Network's AuthCallbackComponent, with one
 * addition: after redeeming the token, it awaits MovesAuthService's
 * getTenantId() once before navigating away. Several ported components
 * (TopDogComponent and everything under it) make backend calls that need
 * MovesAuthService.getTenant() to already be resolvable synchronously via
 * its localStorage cache - see MovesAuthService's class doc comment.
 * Without this await, the destination page's very first API call could
 * fire before that cache is populated.
 */
@Component( {
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth-callback.component.html',
  styleUrl: './auth-callback.component.css',
} )
export class AuthCallbackComponent implements OnInit {
  errorMessage = '';

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private authService: MovesAuthService,
    private signupDraft: MovesSignupDraftService,
    private writeAccess: WriteAccessService,
    private gettingStarted: GettingStartedService,
  ) { }

  async ngOnInit (): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get( 'token' );
    const state = this.route.snapshot.queryParamMap.get( 'state' );
    const pending = this.authService.consumePendingLogin( state );

    if ( !token || !pending ) {
      this.errorMessage = 'This sign-in link is invalid or expired. Please try signing in again.';
      return;
    }

    try {
      await this.authService.signInWithCustomToken( token );
      await firstValueFrom( this.authService.getTenantId() );
      this.writeAccess.refresh();
      // Came through /get-started: save the name to the profile and the
      // planned Move (kept, with a "get the app" banner, until they have
      // the Moves app - see MovesSignupDraftService).
      await this.signupDraft.submitIfPending();

      const returnUrl = pending.returnUrl || '/app';
      // Heading to the default landing (not a deep link) and steps remain:
      // show the Getting Started checklist first, once per session.
      if ( ( returnUrl === '/app' || returnUrl === '/' ) && await this.gettingStarted.shouldShowAfterSignIn() ) {
        await this.router.navigate( ['/help'], { fragment: 'your-progress' } );
        return;
      }
      await this.router.navigateByUrl( returnUrl );
    } catch ( error: any ) {
      this.errorMessage = error?.message || 'Sign-in failed. Please try again.';
    }
  }
}
