import { Component, effect, inject, OnDestroy, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { MovesAssistantSignalService } from '../../services/moves-assistant-signal.service';
import { flowPageContext } from '../flow-assistant-context';
import { FlowStore } from '../flow.store';
import { MoveDrawerComponent } from '../screens/move-drawer.component';
import { ToastComponent } from '../ui/flow-ui.components';

/**
 * Everything under /app: scopes the Find theme, starts the store (demo when
 * signed out or ?demo=1), and hosts the toast and the move drawer, which
 * opens over any screen from ?move=<id>. Also tells TODD's assistant what
 * screen (and move) you're on, so the chat answers about what you see.
 */
@Component( {
  selector: 'mv-flow-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent, MoveDrawerComponent],
  template: `
    <div class="mv mv-root">
      @if (store.mode() === 'loading') {
        <div class="loading"><span></span>Loading your projects…</div>
      } @else {
        <router-outlet />
      }
      @if (moveId(); as id) {
        <mv-move-drawer [moveId]="id" (closed)="closeMove()" />
      }
      <mv-toast />
    </div>
  `,
  styles: [`
    :host { display: block; }
    .mv-root { min-height: 100vh; min-height: 100dvh; }
    .loading { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 100vh; color: var(--muted); font-size: 15px; }
    .loading span { width: 14px; height: 14px; border-radius: 50%; background: var(--blue); animation: pulse 1s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: .3; } }
  `],
} )
export class FlowRootComponent implements OnInit, OnDestroy {
  readonly store = inject( FlowStore );
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  private readonly assistant = inject( MovesAssistantSignalService );
  readonly moveId = toSignal( this.route.queryParamMap.pipe( map( q => q.get( 'move' ) ) ), { initialValue: null } );
  private readonly url = toSignal(
    this.router.events.pipe( filter( ( e ): e is NavigationEnd => e instanceof NavigationEnd ), map( e => e.urlAfterRedirects ) ),
    { initialValue: this.router.url },
  );

  constructor () {
    effect( () => {
      if ( this.store.mode() === 'loading' ) return;
      this.assistant.setPageContext( flowPageContext( {
        url: this.url(), state: this.store.state(), issues: this.store.issues(),
        autonomy: this.store.autonomy(), isSample: this.store.isDemo(),
      } ) );
    } );
  }

  ngOnDestroy (): void {
    // Landing, help and pricing describe themselves; don't leave a project behind.
    this.assistant.clearPageContext();
  }

  ngOnInit (): void {
    this.store.start( this.route.snapshot.queryParamMap.get( 'demo' ) === '1' );
  }

  closeMove (): void {
    void this.router.navigate( [], { queryParams: { move: null }, queryParamsHandling: 'merge', replaceUrl: true } );
  }
}
