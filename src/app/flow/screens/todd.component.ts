import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { choiceLabel } from '../flow-engine';
import { Issue, ToddActionType } from '../flow.models';
import { FlowStore } from '../flow.store';
import { TODD_ICON } from '../ui/flow-ui.components';
import { KIND_LABEL, LogRowsComponent } from '../ui/issue-card.component';

type Filter = 'all' | ToddActionType;

/** 04 TODD - what needs the PM, everything TODD did (with Undo), and the rules it acts within. */
@Component( {
  selector: 'mv-todd',
  standalone: true,
  imports: [LogRowsComponent],
  template: `
    <div class="layout" data-cy="todd">
      <div class="mv-page main">
        <header class="head">
          <img [src]="todd" alt="" class="mv-plate">
          <div>
            <h1 class="mv-title">TODD</h1>
            <p class="mv-sub">Your project assistant · acting within {{ enabledRules() }} rules</p>
          </div>
        </header>

        <div class="mv-label sec">Needs you · {{ store.needsYou().length }}</div>
        <div class="needs">
          @for (i of store.needsYou(); track i.id) {
            <article class="need">
              <span class="meta">{{ where(i) }} · {{ kind(i) }}</span>
              <h3>{{ i.title }}</h3>
              <button type="button" class="mv-btn mv-btn--primary mv-btn--sm" (click)="act(i)">{{ actLabel(i) }}</button>
            </article>
          } @empty {
            <p class="quiet">Nothing needs you. TODD will flag the next break here.</p>
          }
        </div>

        <div class="did-head">
          <span class="mv-label">What I did</span>
          @for (f of filters(); track f.key) {
            <button type="button" class="chip" [class.on]="filter() === f.key" (click)="filter.set(f.key); showAll.set(false)">{{ f.label }}</button>
          }
        </div>
        <mv-log-rows [actions]="visible()" />
        @if (!showAll() && filtered().length > 6) {
          <button type="button" class="mv-link mv-link--pink more" (click)="showAll.set(true)">Show {{ filtered().length - 6 }} more</button>
        }
      </div>

      <aside class="rules">
        <h2>Rules I follow</h2>
        <p class="intro">I act on these without asking. Everything else comes to you.</p>
        @for (r of store.state().rules; track r.id) {
          <div class="rule">
            <p><strong>{{ r.lead }}</strong> {{ r.text }}</p>
            @if (r.locked) {
              <span class="locked">Locked</span>
            } @else {
              <button type="button" class="mv-toggle" [class.on]="r.enabled" role="switch" [attr.aria-checked]="r.enabled" [attr.aria-label]="r.lead" (click)="store.setRule(r.id, !r.enabled)"></button>
            }
          </div>
        }
      </aside>
    </div>
  `,
  styles: [`
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 28px; padding-right: 36px; }
    .main { padding-right: 0; }
    .head { display: flex; align-items: center; gap: 14px; }
    .head img { width: 48px; height: 48px; border-radius: 50%; }
    .sec { margin: 26px 0 12px; }
    .needs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .need { background: var(--surface); border-radius: 24px; padding: 16px 16px 14px; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
    .need .meta { font-size: 13px; color: var(--muted); }
    .need h3 { font-size: 16px; line-height: 1.3; margin-bottom: 6px !important; flex: 1; }
    .quiet { font-size: 14px; color: var(--text2); grid-column: 1 / -1; }
    .did-head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 28px 0 10px; }
    .did-head .mv-label { margin-right: 8px; }
    .chip { border: 1px solid var(--surface2); background: var(--bg); border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 700; cursor: pointer; color: var(--text); }
    .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
    .more { margin-top: 14px; font-size: 14px; }
    .rules { align-self: start; margin-top: 30px; background: var(--surface); border-radius: 32px; padding: 26px 22px; position: sticky; top: 20px; }
    .rules h2 { font-size: 22px; }
    .intro { font-size: 13px; color: var(--text2); margin: 8px 0 6px !important; }
    .rule { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; padding: 14px 0; border-top: 1px solid var(--surface2); }
    .rule p { font-size: 14px; line-height: 1.4; color: var(--text); }
    .locked { font-size: 11px; font-weight: 700; color: var(--muted); padding: 2px 10px 0 0; }
    @media (max-width: 1100px) {
      .layout { grid-template-columns: minmax(0, 1fr); padding: 0 36px 40px 0; }
      .rules { position: static; margin: 0 0 0 36px; }
      .needs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 720px) {
      .layout { padding: 0 16px 40px 0; }
      .rules { margin-left: 16px; }
      .needs { grid-template-columns: 1fr; }
    }
  `],
} )
export class ToddComponent {
  readonly store = inject( FlowStore );
  private readonly router = inject( Router );
  readonly todd = TODD_ICON;
  readonly filter = signal<Filter>( 'all' );
  readonly showAll = signal( false );

  readonly enabledRules = computed( () => this.store.state().rules.filter( r => r.enabled ).length );
  readonly log = computed( () => [...this.store.state().actions].sort( ( a, b ) => b.createdAt.localeCompare( a.createdAt ) ) );
  readonly filters = computed( () => {
    const count = this.log().length;
    const base: { key: Filter; label: string }[] = [
      { key: 'all', label: `All ${count}` }, { key: 'reassigned', label: 'Reassigned' }, { key: 'nudged', label: 'Nudged' },
      { key: 'rescheduled', label: 'Rescheduled' }, { key: 'split', label: 'Split' },
    ];
    return base;
  } );
  readonly filtered = computed( () => this.filter() === 'all' ? this.log() : this.log().filter( a => a.type === this.filter() ) );
  readonly visible = computed( () => this.showAll() ? this.filtered() : this.filtered().slice( 0, 6 ) );

  where ( i: Issue ): string {
    if ( i.kind === 'pileup' ) return 'Maya';
    if ( i.kind === 'capacity' ) return 'Team';
    return ( this.store.project( i.projectId )?.name || 'Moves' ).split( ' ' )[0];
  }

  kind ( i: Issue ): string {
    return KIND_LABEL[i.kind];
  }

  actLabel ( i: Issue ): string {
    if ( i.kind === 'order' ) return 'Review';
    if ( i.kind === 'pileup' ) return 'Decide';
    return i.choices[0] ? choiceLabel( i.choices[0] ) : 'Open';
  }

  act ( i: Issue ): void {
    if ( i.kind === 'order' ) {
      void this.router.navigate( ['/app/projects', i.projectId, 'sequence'] );
      return;
    }
    const c = i.choices[0];
    if ( i.kind === 'pileup' || !c ) {
      void this.router.navigate( ['/app/review'], { queryParams: { item: i.id } } );
      return;
    }
    if ( c.run.kind === 'open' ) void this.router.navigate( [], { queryParams: { move: c.run.moveId }, queryParamsHandling: 'merge' } );
    else this.store.run( c, i );
  }
}
