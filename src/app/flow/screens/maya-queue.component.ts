import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { fmtDue } from '../flow-dates';
import { FlowMove } from '../flow.models';
import { FlowStore } from '../flow.store';

const MAYA_URL = 'https://marketing.16ahead.com';

/**
 * Maya's review queue - the tasks she made that wait on you. Maya's Status
 * page links here ("Review 56 tasks"): while too many are open she makes no
 * new work, so clearing this list is what lets her move on.
 */
@Component( {
  selector: 'mv-maya-queue',
  standalone: true,
  template: `
    <div class="mv-page" data-cy="maya-queue">
      <header class="head">
        <div>
          <h1 class="mv-title">The Marketing Assistant’s tasks</h1>
          <p class="mv-sub">{{ subtitle() }}</p>
        </div>
        <a class="mv-btn" [href]="mayaUrl" target="_blank" rel="noopener">The Marketing Assistant’s status</a>
      </header>

      @for (m of store.mayaQueue(); track m.id) {
        <article class="task" data-cy="maya-queue-row">
          <button type="button" class="txt" (click)="open(m.id)">
            <strong>{{ m.title }}</strong>
            @if (m.nextAction) { <span>{{ m.nextAction }}</span> }
            <span class="when">Due {{ due(m) }}</span>
          </button>
          <button type="button" class="mv-btn mv-btn--primary mv-btn--sm" data-cy="maya-queue-done" (click)="store.markDone(m.id)">Done</button>
        </article>
      } @empty {
        <div class="mv-empty">Nothing waiting on you. The Marketing Assistant can keep going.</div>
      }
    </div>
  `,
  styles: [`
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
    .task { display: flex; align-items: center; gap: 14px; padding: 14px 16px 14px 20px; margin-top: 10px; border-radius: 24px; background: var(--surface); }
    .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; text-align: left; border: 0; background: none; padding: 0; cursor: pointer; color: var(--text); }
    .txt strong { font-size: 16px; }
    .txt span { font-size: 14px; color: var(--text2); }
    .txt .when { font-size: 13px; color: var(--muted); }
  `],
} )
export class MayaQueueComponent {
  readonly store = inject( FlowStore );
  private readonly router = inject( Router );
  readonly mayaUrl = `${MAYA_URL}/marketing-employee`;

  subtitle (): string {
    const n = this.store.mayaQueue().length;
    if ( !n ) return 'It made these for you to review.';
    return `${n} task${n === 1 ? '' : 's'} it made for you. Mark each one done when you’ve handled it; when enough are cleared it starts new work again.`;
  }

  due ( m: FlowMove ): string {
    return fmtDue( m.due, this.store.state().now );
  }

  open ( id: string ): void {
    void this.router.navigate( [], { queryParams: { move: id }, queryParamsHandling: 'merge' } );
  }
}
