import { AsyncPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { MovesAuthService } from '../../services/moves-auth.service';
import { ThemeService } from '../../services/theme.service';
import { PlatformMenuComponent } from '../../shared/platform-menu/platform-menu.component';
import { projectHealth } from '../flow-engine';
import { FlowStore } from '../flow.store';
import { AvatarComponent, MOVES_ICON } from '../ui/flow-ui.components';

/**
 * Desktop: the 224px left rail (Momentum / Team / Review / TODD, projects
 * with health dots, the user). Phone: a slim top bar and the bottom tab
 * bar from the PM digest (Digest / Momentum / Team / Review).
 */
@Component( {
  selector: 'mv-flow-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AvatarComponent, PlatformMenuComponent, AsyncPipe],
  template: `
    <div class="shell" data-cy="flow-shell">
      <aside class="rail">
        <a class="brand" routerLink="/app"><img [src]="logo" alt="" class="logo"><span>Moves</span></a>
        <nav class="rnav" aria-label="Main">
          <a routerLink="/app" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }">Momentum</a>
          <a routerLink="/app/team" routerLinkActive="on">Team</a>
          <a routerLink="/app/review">Review</a>
          <a routerLink="/app/todd" routerLinkActive="on">TODD
            @if (store.needsYou().length) { <span class="count">{{ store.needsYou().length }}</span> }
          </a>
        </nav>
        <div class="mv-label section">Projects</div>
        <nav class="projects" aria-label="Projects">
          @for (p of projects(); track p.id) {
            <a [routerLink]="['/app/projects', p.id]" routerLinkActive="on"><span class="dot" [class.green]="p.dot === 'green'"></span>{{ p.name }}</a>
          }
          <a class="new" routerLink="/app/new">+ New project</a>
        </nav>
        <div class="foot">
          @if (store.isDemo()) {
            <div class="demo">
              Sample team. <a (click)="signIn()">Sign in</a> to see yours.
              <button type="button" class="mv-link" (click)="store.resetDemo()">Reset demo</button>
            </div>
          }
          <div class="user">
            <mv-avatar [person]="store.pm()" />
            <div class="who"><strong>{{ store.pm()?.name }}</strong><span>{{ store.pm()?.role }}</span></div>
          </div>
          <div class="tools">
            <app-platform-menu [isAdmin]="(isAdmin$ | async) ?? false" [isLoggedIn]="(isLoggedIn$ | async) ?? false" [userName]="(userName$ | async) ?? ''" [userEmail]="(userEmail$ | async) ?? ''" (signOut)="signOut()" />
            <button type="button" class="theme" (click)="theme.toggle()" [attr.aria-label]="theme.isDark() ? 'Light mode' : 'Dark mode'">{{ theme.isDark() ? '☀' : '☾' }}</button>
          </div>
        </div>
      </aside>

      <header class="topbar">
        <a routerLink="/app" class="brand"><img [src]="logo" alt="" class="logo"><span>Moves</span></a>
        <button type="button" class="theme" (click)="theme.toggle()" [attr.aria-label]="theme.isDark() ? 'Light mode' : 'Dark mode'">{{ theme.isDark() ? '☀' : '☾' }}</button>
        <app-platform-menu [isAdmin]="(isAdmin$ | async) ?? false" [isLoggedIn]="(isLoggedIn$ | async) ?? false" [userName]="(userName$ | async) ?? ''" [userEmail]="(userEmail$ | async) ?? ''" (signOut)="signOut()" />
      </header>

      <main class="main">
        @if (store.error()) { <div class="error">{{ store.error() }}</div> }
        <router-outlet />
      </main>

      <nav class="tabbar" aria-label="Main">
        <a routerLink="/app/digest" routerLinkActive="on">Digest</a>
        <a routerLink="/app" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }">Momentum</a>
        <a routerLink="/app/team" routerLinkActive="on">Team</a>
        <a routerLink="/app/review">Review</a>
      </nav>
    </div>
  `,
  styles: [`
    .shell { display: flex; min-height: 100vh; min-height: 100dvh; background: var(--bg); }
    .rail { width: 224px; flex: none; background: var(--surface); padding: 22px 14px; display: flex; flex-direction: column; gap: 4px; position: sticky; top: 0; height: 100vh; height: 100dvh; overflow-y: auto; }
    .brand { display: flex; align-items: center; gap: 10px; padding: 0 10px 20px; text-decoration: none !important; color: var(--text) !important; }
    .brand span { font-weight: 700; letter-spacing: -0.03em; font-size: 23px; }
    .logo { width: 30px; height: 30px; border-radius: 9px; background: #fff; }
    .rnav { display: flex; flex-direction: column; gap: 4px; }
    .rnav a { display: flex; justify-content: space-between; align-items: center; padding: 9px 14px; border-radius: 999px; font-size: 15px; color: var(--text); text-decoration: none; }
    .rnav a:hover { background: var(--surface2); color: var(--text); }
    .rnav a.on { background: var(--text); color: var(--bg); font-weight: 700; }
    .count { background: var(--blue); color: #fff; font-size: 12px; font-weight: 700; border-radius: 999px; padding: 1px 8px; }
    .section { padding: 22px 14px 6px; }
    .projects { display: flex; flex-direction: column; gap: 2px; }
    .projects a { display: flex; gap: 9px; align-items: center; padding: 7px 14px; border-radius: 999px; font-size: 14px; color: var(--text); text-decoration: none; }
    .projects a:hover { background: var(--surface2); color: var(--text); }
    .projects a.on { background: var(--text); color: var(--bg); font-weight: 700; }
    .projects a.new { color: var(--blue-ink); font-weight: 700; margin-top: 6px; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--pink); flex: none; }
    .dot.green { background: var(--green); }
    .foot { margin-top: auto; padding-top: 24px; display: flex; flex-direction: column; gap: 12px; }
    .demo { font-size: 12px; color: var(--muted); padding: 0 10px; line-height: 1.5; }
    .demo .mv-link { display: block; font-size: 12px; margin-top: 4px; }
    .user { display: flex; align-items: center; gap: 10px; padding: 0 10px; }
    .who { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
    .who strong { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .who span { font-size: 13px; color: var(--muted); }
    .tools { display: flex; align-items: center; justify-content: space-between; padding: 0 10px; }
    .theme { border: 0; background: none; color: var(--muted); cursor: pointer; font-size: 16px; padding: 4px; }
    .main { flex: 1; min-width: 0; }
    .error { margin: 16px 36px 0; padding: 12px 16px; border-radius: 14px; background: var(--t-pink); color: var(--t-pink-fg); font-weight: 700; font-size: 14px; }
    .topbar, .tabbar { display: none; }
    @media (max-width: 900px) {
      .rail { display: none; }
      .shell { flex-direction: column; }
      .topbar { display: flex; align-items: center; gap: 8px; padding: 12px 16px; position: sticky; top: 0; z-index: 20; background: var(--bg); border-bottom: 1px solid var(--surface2); }
      .topbar .brand { padding: 0; margin-right: auto; }
      .topbar .brand span { font-size: 19px; }
      .topbar .logo { width: 26px; height: 26px; }
      .tabbar { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; background: var(--bg); border-top: 1px solid var(--surface2); padding: 10px 8px calc(10px + env(safe-area-inset-bottom)); }
      .tabbar a { flex: 1; text-align: center; font-size: 15px; font-weight: 700; color: var(--text); text-decoration: none; }
      .tabbar a.on { color: var(--t-pink-fg); }
      .main { padding-bottom: 72px; }
    }
  `],
} )
export class FlowShellComponent {
  readonly store = inject( FlowStore );
  readonly theme = inject( ThemeService );
  private readonly auth = inject( MovesAuthService );
  private readonly router = inject( Router );
  readonly logo = MOVES_ICON;

  readonly isAdmin$ = this.auth.getUser().pipe( map( u => u?.uid === environment.taliferroTenantId ) );
  readonly isLoggedIn$ = this.auth.isLoggedIn();
  readonly userName$ = this.auth.getUser().pipe( map( u => u?.displayName || '' ) );
  readonly userEmail$ = this.auth.getUser().pipe( map( u => u?.email || '' ) );

  readonly projects = computed( () => {
    const s = this.store.state();
    const issues = this.store.issues();
    return this.store.projects().map( p => ( { id: p.id, name: p.name, dot: projectHealth( s, p, issues ).dot } ) );
  } );

  signIn (): void {
    void this.router.navigate( ['/login'], { queryParams: { returnUrl: '/app' } } );
  }

  async signOut (): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl( '/' );
  }
}
