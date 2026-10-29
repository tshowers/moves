import { AsyncPipe } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LockupComponent } from '../brand/brand.components';
import { MovesAuthService } from '../../services/moves-auth.service';
import { ThemeService } from '../../services/theme.service';
import { PlatformMenuComponent } from '../platform-menu/platform-menu.component';

/**
 * The bar on every page outside /app (app.component): the 16Ahead lockup
 * home, Help / Pricing / iPhone, the theme switch, Open Moves and the Menu.
 * Same tokens, pills and lockup as the /app rail. landing: also the
 * landing page's in-page links.
 */
@Component( {
  selector: 'mv-site-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AsyncPipe, LockupComponent, PlatformMenuComponent],
  template: `
    <header class="site" data-cy="site-header">
      <a class="home" routerLink="/" aria-label="16Ahead Moves home"><mv-lockup /></a>
      <nav class="links" aria-label="Site">
        @if (landing()) {
          <a href="#signal">The signal</a>
          <a href="#system">The system</a>
        }
        <a routerLink="/help" routerLinkActive="on">Help</a>
        <a routerLink="/pricing" routerLinkActive="on">Pricing</a>
        <a routerLink="/ios" routerLinkActive="on">iPhone</a>
      </nav>
      <button type="button" class="theme" (click)="theme.toggle()" [attr.aria-label]="theme.isDark() ? 'Light mode' : 'Dark mode'">{{ theme.isDark() ? '☀' : '☾' }}</button>
      <a class="open" routerLink="/app" data-cy="site-open-app">Open Moves</a>
      <app-platform-menu [isAdmin]="(isAdmin$ | async) ?? false" [isLoggedIn]="(isLoggedIn$ | async) ?? false" [userName]="(userName$ | async) ?? ''" [userEmail]="(userEmail$ | async) ?? ''" (signOut)="signOut()" />
    </header>
  `,
  styles: [`
    :host { display: block; position: sticky; top: 0; z-index: 50; }
    .site {
      display: flex; align-items: center; gap: 8px; height: 68px; padding: 0 max(24px, calc((100% - 1280px) / 2));
      background: var(--bg); border-bottom: 1px solid var(--surface2); font-family: var(--font);
    }
    .home { text-decoration: none; margin-right: auto; }
    .links { display: flex; gap: 4px; }
    .links a { padding: 8px 14px; border-radius: 999px; font-size: 15px; color: var(--text); text-decoration: none; }
    .links a:hover { background: var(--surface2); }
    .links a.on { background: var(--text); color: var(--bg); font-weight: 700; }
    .theme { border: 0; background: none; color: var(--muted); cursor: pointer; font-size: 16px; padding: 4px 8px; min-height: 0; }
    .open {
      display: inline-flex; align-items: center; border-radius: 999px; background: var(--blue); color: #fff;
      padding: 8px 16px; font-size: 14px; font-weight: 700; text-decoration: none; white-space: nowrap;
    }
    .open:hover { opacity: .88; color: #fff; }
    @media (max-width: 860px) {
      .site { height: 60px; padding: 0 16px; gap: 4px; }
      .links { display: none; }
      .open { padding: 7px 12px; font-size: 13px; }
    }
  `],
} )
export class SiteHeaderComponent {
  readonly landing = input( false );

  readonly theme = inject( ThemeService );
  private readonly auth = inject( MovesAuthService );
  private readonly router = inject( Router );

  readonly isAdmin$ = this.auth.getUser().pipe( map( u => u?.uid === environment.taliferroTenantId ) );
  readonly isLoggedIn$ = this.auth.isLoggedIn();
  readonly userName$ = this.auth.getUser().pipe( map( u => u?.displayName || '' ) );
  readonly userEmail$ = this.auth.getUser().pipe( map( u => u?.email || '' ) );

  async signOut (): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl( '/' );
  }
}
