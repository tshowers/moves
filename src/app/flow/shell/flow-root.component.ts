import { Component, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { FlowStore } from '../flow.store';
import { MoveDrawerComponent } from '../screens/move-drawer.component';
import { ToastComponent } from '../ui/flow-ui.components';

/**
 * Everything under /app: scopes the Find theme, starts the store (demo when
 * signed out or ?demo=1), and hosts the toast and the move drawer, which
 * opens over any screen from ?move=<id>.
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
export class FlowRootComponent implements OnInit {
  readonly store = inject( FlowStore );
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  readonly moveId = toSignal( this.route.queryParamMap.pipe( map( q => q.get( 'move' ) ) ), { initialValue: null } );

  ngOnInit (): void {
    this.store.start( this.route.snapshot.queryParamMap.get( 'demo' ) === '1' );
  }

  closeMove (): void {
    void this.router.navigate( [], { queryParams: { move: null }, queryParamsHandling: 'merge', replaceUrl: true } );
  }
}
