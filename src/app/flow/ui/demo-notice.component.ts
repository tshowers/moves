import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { FlowStore } from '../flow.store';

/**
 * The note on every /app screen while it shows the sample team: you're not
 * signed in and none of this is real. Looks like the shared browse notice
 * (shared/write-access/browse-notice.component.ts). Hosts set the margin.
 */
@Component( {
  selector: 'mv-demo-notice',
  standalone: true,
  template: `
    @if (store.isDemo()) {
      <aside class="bn" role="note" data-cy="demo-notice">
        <p><strong>You’re not signed in.</strong> This sample team is for demonstration purposes only. Sign in to see your own projects and tasks.</p>
        <button type="button" class="bn__btn" (click)="signIn()">Sign in</button>
      </aside>
    }
  `,
  styles: [`
    :host { display: block; }
    :host:empty { display: none; }
    .bn { display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 18px; border-radius: 18px; background: var(--t-blue); color: var(--t-blue-fg); }
    .bn p { flex: 1; margin: 0; font-size: 14px; line-height: 1.45; }
    .bn__btn { display: inline-flex; align-items: center; height: 36px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--text); color: var(--bg) !important; font-family: inherit; font-size: 14px; font-weight: 700; line-height: 1; white-space: nowrap; cursor: pointer; }
  `],
} )
export class DemoNoticeComponent {
  readonly store = inject( FlowStore );
  private readonly router = inject( Router );

  /** Back to this screen after signing in. */
  signIn (): void {
    void this.router.navigate( ['/login'], { queryParams: { returnUrl: this.router.url.split( '?' )[0] || '/app' } } );
  }
}
