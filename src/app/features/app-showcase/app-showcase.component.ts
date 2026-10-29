import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { map } from 'rxjs';
import { SeoService } from '../../services/seo.service';
import { ThemeService } from '../../services/theme.service';
import { MovesAuthService } from '../../services/moves-auth.service';
import { PlatformMenuComponent } from '../../shared/platform-menu/platform-menu.component';
import { environment } from '../../../environments/environment';

@Component( {
  selector: 'app-moves-ios-showcase',
  standalone: true,
  imports: [CommonModule, RouterModule, PlatformMenuComponent],
  templateUrl: './app-showcase.component.html',
  styleUrls: [ './app-showcase.component.css', './app-showcase.responsive.css' ]
} )
export class AppShowcaseComponent {
  /** Prerendered for search engines (app.routes.server.ts). Same title as the route's. */
  private readonly seo = inject( SeoService ).page( {
    title: 'Moves for iPhone | 16Ahead',
    description: 'Moves for iPhone: your next moves, hand-offs from 16Ahead with Done and Can’t do it right on the notification, and the same account as the web.',
  } );
  readonly theme = inject(ThemeService);
  private readonly router = inject( Router );
  private readonly authService = inject( MovesAuthService );

  // Mirrors app.component.ts's isAdmin$/isLoggedIn$/signOut() - this page
  // hosts app-platform-menu inline in its own nav bar instead of the
  // global fixed one, so it needs the same auth wiring locally.
  readonly isAdmin$ = this.authService.getUser().pipe( map( user => user?.uid === environment.taliferroTenantId ) );
  readonly isLoggedIn$ = this.authService.isLoggedIn();

  async signOut (): Promise<void> {
    await this.authService.signOut();
    await this.router.navigateByUrl( '/' );
  }

  readonly highlights = [
    { heading: 'See what needs attention before it stalls', copy: 'Open Moves and get a clear read on the work that is aging, blocked, or ready for the next action.' },
    { heading: 'Create the next move in the moment', copy: 'Capture a follow-up while the conversation is fresh and connect it to the contact, deal, or campaign it serves.' },
    { heading: 'Keep momentum visible wherever you work', copy: 'Your move list stays connected to the same momentum signals 16Ahead watches on the web.' }
  ];
}
