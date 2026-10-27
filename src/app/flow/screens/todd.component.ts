import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { fmtLong } from '../flow-dates';
import { choiceLabel } from '../flow-engine';
import { Issue, ToddActionType } from '../flow.models';
import { FlowStore } from '../flow.store';
import { TODD_ICON } from '../ui/flow-ui.components';
import { KIND_LABEL, LogRowsComponent } from '../ui/issue-card.component';

type Filter = 'all' | 'practice' | ToddActionType;

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
            <p class="mv-sub">Your project assistant · {{ modeLine() }}</p>
          </div>
        </header>

        <div class="mv-label sec">Needs you · {{ store.needsYou().length }}</div>
        <div class="needs">
          @for (i of store.needsYou(); track i.id) {
            <article class="need">
              <span class="meta">{{ where(i) }} · {{ kind(i) }}</span>
              <h3>{{ i.title }}</h3>
              @if (resolving() === i.id) {
                <!-- "I handled it": an optional note, then done (2026-10-27). -->
                <textarea class="note" rows="2" [value]="resolveNote()" (input)="resolveNote.set($any($event.target).value)" placeholder="What happened? (optional)" aria-label="What happened? (optional)" data-cy="todd-resolve-note"></textarea>
                <div class="need-actions">
                  <button type="button" class="mv-btn mv-btn--primary mv-btn--sm" (click)="resolve(i)" data-cy="todd-resolve-done">Mark done</button>
                  <button type="button" class="mv-btn mv-btn--sm" (click)="resolving.set(null)">Back</button>
                </div>
              } @else {
                <div class="need-actions">
                  <button type="button" class="mv-btn mv-btn--primary mv-btn--sm" (click)="act(i)">{{ actLabel(i) }}</button>
                  @if (doneMove(i)) {
                    <button type="button" class="mv-btn mv-btn--sm" (click)="startResolve(i)" data-cy="todd-handled">I handled it</button>
                  }
                </div>
              }
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
        <div class="mode" [class]="'mode mode--' + store.autonomy().mode" data-cy="todd-mode">
          @switch (store.autonomy().mode) {
            @case ('dry_run') {
              <p><strong>Practising{{ practiceEnds() ? ' until ' + practiceEnds() : '' }}.</strong> I log what I would do and change nothing. Then I switch on.</p>
              <div class="mode-actions">
                <button type="button" class="mv-btn mv-btn--primary mv-btn--sm" (click)="store.setAutonomy('on')">Turn on now</button>
                <button type="button" class="mv-btn mv-btn--sm" (click)="store.setAutonomy('off')">Pause</button>
              </div>
            }
            @case ('on') {
              <p><strong>On.</strong> I act within these rules and log everything with Undo.</p>
              <div class="mode-actions">
                <button type="button" class="mv-btn mv-btn--sm" (click)="store.setAutonomy('off')">Pause</button>
                <button type="button" class="mv-btn mv-btn--sm" (click)="store.setAutonomy('dry_run')">Practise instead</button>
              </div>
            }
            @default {
              <p><strong>Paused.</strong> I still flag breaks; I just won’t act on them.</p>
              <div class="mode-actions">
                <button type="button" class="mv-btn mv-btn--primary mv-btn--sm" (click)="store.setAutonomy('on')">Turn on</button>
              </div>
            }
          }
        </div>
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
    .need-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .need .note { width: 100%; padding: 10px 12px; border: 1px solid var(--surface2); border-radius: 14px; background: var(--bg); color: var(--text); font: inherit; font-size: 14px; resize: vertical; }
    .quiet { font-size: 14px; color: var(--text2); grid-column: 1 / -1; }
    .did-head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 28px 0 10px; }
    .did-head .mv-label { margin-right: 8px; }
    .chip { border: 1px solid var(--surface2); background: var(--bg); border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 700; cursor: pointer; color: var(--text); }
    .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
    .more { margin-top: 14px; font-size: 14px; }
    .rules { align-self: start; margin-top: 30px; background: var(--surface); border-radius: 32px; padding: 26px 22px; position: sticky; top: 20px; }
    .rules h2 { font-size: 22px; }
    .mode { border-radius: 20px; padding: 14px 16px; margin-bottom: 20px; background: var(--bg); font-size: 13px; line-height: 1.45; color: var(--text2); }
    .mode strong { color: var(--text); }
    .mode--dry_run { box-shadow: inset 0 0 0 1.5px var(--blue); }
    .mode--off { box-shadow: inset 0 0 0 1.5px var(--n500); }
    .mode-actions { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
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
  /** The card whose "I handled it" note is open. */
  readonly resolving = signal<string | null>( null );
  readonly resolveNote = signal( '' );

  readonly enabledRules = computed( () => this.store.state().rules.filter( r => r.enabled ).length );
  readonly practiceEnds = computed( () => {
    const at = this.store.autonomy().practiceEndsAt;
    return at ? fmtLong( at ) : '';
  } );
  readonly modeLine = computed( () => {
    const n = this.enabledRules();
    return { on: `acting within ${n} rules`, dry_run: `practising within ${n} rules`, off: 'paused' }[this.store.autonomy().mode];
  } );
  readonly log = computed( () => [...this.store.state().actions].sort( ( a, b ) => b.createdAt.localeCompare( a.createdAt ) ) );
  readonly filters = computed( () => {
    const count = this.log().length;
    const base: { key: Filter; label: string }[] = [
      { key: 'all', label: `All ${count}` }, { key: 'reassigned', label: 'Reassigned' }, { key: 'nudged', label: 'Nudged' },
      { key: 'rescheduled', label: 'Rescheduled' }, { key: 'split', label: 'Split' },
    ];
    const practice = this.log().filter( a => a.dryRun ).length;
    return practice ? [...base, { key: 'practice' as Filter, label: `Would have ${practice}` }] : base;
  } );
  readonly filtered = computed( () => {
    const f = this.filter();
    if ( f === 'all' ) return this.log();
    if ( f === 'practice' ) return this.log().filter( a => a.dryRun );
    return this.log().filter( a => a.type === f && !a.dryRun );
  } );
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

  /** The move "I handled it" closes, when the issue offers it. */
  doneMove ( i: Issue ): string {
    const c = i.choices.find( x => x.run.kind === 'done' );
    return c?.run.kind === 'done' ? c.run.moveId : '';
  }

  startResolve ( i: Issue ): void {
    this.resolveNote.set( '' );
    this.resolving.set( i.id );
  }

  async resolve ( i: Issue ): Promise<void> {
    const id = this.doneMove( i );
    if ( !id ) return;
    await this.store.resolve( id, this.resolveNote() );
    this.resolving.set( null );
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
