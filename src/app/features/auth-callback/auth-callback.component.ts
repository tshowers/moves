import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MovesAuthService } from '../../services/moves-auth.service';

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
      await this.router.navigateByUrl( pending.returnUrl || '/app' );
    } catch ( error: any ) {
      this.errorMessage = error?.message || 'Sign-in failed. Please try again.';
    }
  }
}
