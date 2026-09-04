import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MovesAuthService } from '../../services/moves-auth.service';

/**
 * Sign-in for Moves doesn't happen natively in this app - it redirects to
 * TODD's hosted login (todd.taliferro.tech/login, the same page
 * network-ios/pulse-ios open via TODDAuthKit's HostedLogin) instead of
 * rendering its own Google/Apple/email-link buttons. See
 * MovesAuthService.signIn() for the handoff. Ported from Network's
 * SignInComponent - MovesPurchaseFlowService.goToLogin() navigates here
 * with a `returnUrl` query param.
 */
@Component( {
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
} )
export class SignInComponent implements OnInit {
  isSigningIn = false;

  private returnUrl = '/app';

  constructor (
    private route: ActivatedRoute,
    private authService: MovesAuthService,
  ) { }

  ngOnInit (): void {
    this.returnUrl = this.route.snapshot.queryParamMap.get( 'returnUrl' ) || '/app';
  }

  signIn (): void {
    this.isSigningIn = true;
    this.authService.signIn( this.returnUrl );
  }
}
