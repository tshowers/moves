import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { addDays, daysBetween, fmtDay } from '../flow-dates';
import { isParked, liveActions, moveById, projectMoves, trackFor } from '../flow-engine';
import { FlowMove, Issue, IssueChoice } from '../flow.models';
import { FlowStore } from '../flow.store';
import { DemoNoticeComponent } from '../ui/demo-notice.component';
import { FlowTrackComponent } from '../ui/flow-track.component';
import { MOVES_ICON } from '../ui/flow-ui.components';
import { KIND_LABEL } from '../ui/issue-card.component';

/** 07 Weekly review / standup - one decision at a time, only what needs the PM. */
@Component( {
  selector: 'mv-review',
  standalone: true,
  imports: [RouterLink, FlowTrackComponent, DemoNoticeComponent],
  template: `
    <div class="frame" data-cy="review">
      <mv-demo-notice class="notice" />
      <header class="top">
        <img [src]="logo" alt="" class="logo">
        <h1>Weekly review</h1>
        <span class="meta">{{ today }} · {{ items().length }} break{{ items().length === 1 ? '' : 's' }} across {{ projectCount() }} project{{ projectCount() === 1 ? '' : 's' }}</span>
        <button type="button" class="mv-btn share" (click)="share()">Share to standup</button>
        <a class="mv-btn" routerLink="/app">Exit</a>
      </header>

      <div class="body">
        <aside class="list">
          <div class="mv-label">{{ items().length ? (index() + 1) + ' of ' + items().length : 'Nothing to decide' }}</div>
          <ol>
            @for (i of items(); track i.id; let n = $index) {
              <li>
                <button type="button" [class.on]="n === index()" (click)="go(n)">
                  <span class="mk" [class.done]="isDone(i)" [class.cur]="n === index() && !isDone(i)">@if (isDone(i)) { ✓ }</span>
                  <span [class.dim]="isDone(i)">{{ i.label }}</span>
                </button>
              </li>
            }
          </ol>
          <p class="fine">16Ahead only lists what needs a decision. The {{ fixedCount() }} thing{{ fixedCount() === 1 ? '' : 's' }} it fixed {{ fixedCount() === 1 ? 'is' : 'are' }} in the log.</p>
        </aside>

        <main class="stage">
          @if (current(); as i) {
            @if (confirm(); as msg) {
              <div class="confirm" data-cy="review-confirm">
                <span class="mv-tag mv-tag--green">Decided</span>
                <h2>{{ msg }}</h2>
                <div class="confirm-actions">
                  @if (nextOpen() !== null) {
                    <button type="button" class="mv-btn mv-btn--primary mv-btn--lg" (click)="go(nextOpen()!)">Next: {{ items()[nextOpen()!].label }}</button>
                  } @else {
                    <p class="all">That’s everything for this week.</p>
                  }
                  <a class="mv-btn mv-btn--lg" routerLink="/app">Back to Momentum</a>
                </div>
              </div>
            } @else {
              <span class="mv-tag mv-tag--pink mv-tag--lg">{{ where(i) }} · {{ kind(i) }}</span>
              <h2 class="q">{{ i.question }}</h2>
              <p class="cons">{{ i.consequence }}</p>
              @if (zoom(); as z) {
                <div class="zoom"><mv-flow-track [model]="z" size="lg" [showToday]="false" [clickable]="true" (nodeClick)="openMove($event)" /></div>
              }
              @if (resolving() === i.id) {
                <!-- "I handled it": what happened, then done (2026-10-27). -->
                <div class="resolve" data-cy="review-resolve">
                  <label for="resolve-note">What happened? <span>Optional - it’s kept on the move.</span></label>
                  <textarea id="resolve-note" rows="3" [value]="resolveNote()" (input)="resolveNote.set($any($event.target).value)" placeholder="Sent it myself on Friday."></textarea>
                  <div class="resolve-actions">
                    <button type="button" class="mv-btn mv-btn--primary mv-btn--lg" (click)="finishResolve()" data-cy="review-resolve-done">Mark done</button>
                    <button type="button" class="mv-btn mv-btn--lg" (click)="resolving.set(null)">Back</button>
                  </div>
                </div>
              } @else {
                <div class="choices">
                  @for (c of i.choices; track c.label; let n = $index) {
                    <button type="button" class="choice" data-cy="review-choice" [class.primary]="n === 0" (click)="choose(c)">
                      <strong>{{ c.label }}</strong><span>{{ c.hint }}</span>
                    </button>
                  }
                </div>
              }
            }
            <footer class="foot">
              <button type="button" class="back" (click)="go(index() - 1)" [disabled]="index() === 0">← Back</button>
              <span class="dots">
                @for (x of items(); track x.id; let n = $index) {
                  <i [class.done]="isDone(x)" [class.cur]="n === index()"></i>
                }
              </span>
              <span class="hint">Press 1–{{ i.choices.length }} to choose</span>
            </footer>
          } @else {
            <div class="confirm">
              <h2>Nothing needs a decision.</h2>
              <p class="cons">16Ahead will bring the next break here. Everything it fixed on its own is in the log.</p>
              <div class="confirm-actions"><a class="mv-btn mv-btn--primary mv-btn--lg" routerLink="/app">Back to Momentum</a><a class="mv-btn mv-btn--lg" routerLink="/app/todd">See the log</a></div>
            </div>
          }
        </main>
      </div>
    </div>
  `,
  styles: [`
    .notice { margin: 16px 36px 0; }
    .frame { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; background: var(--bg); }
    .top { display: flex; align-items: center; gap: 14px; padding: 18px 32px; border-bottom: 1px solid var(--surface2); flex-wrap: wrap; }
    .logo { width: 30px; height: 30px; border-radius: 8px; background: #fff; }
    .top h1 { font-size: 20px; }
    .meta { font-size: 14px; color: var(--muted); margin-right: auto; }
    .top .mv-btn { padding: 9px 16px; }
    .body { flex: 1; display: grid; grid-template-columns: 270px minmax(0, 1fr); }
    .list { background: var(--surface); padding: 24px 16px; display: flex; flex-direction: column; }
    .list .mv-label { padding: 0 10px 10px; }
    ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
    ol button { display: flex; gap: 10px; align-items: flex-start; text-align: left; width: 100%; padding: 9px 10px; border-radius: 16px; font-size: 14px; color: var(--text2); cursor: pointer; line-height: 1.4; }
    ol button.on { background: var(--bg); color: var(--text); font-weight: 700; box-shadow: var(--shadow-sm); }
    .mk { width: 20px; height: 20px; flex: none; border-radius: 50%; border: 2px solid var(--n500); display: inline-flex; align-items: center; justify-content: center; font-size: 12px; color: #fff; font-weight: 700; }
    .mk.done { background: var(--green); border-color: var(--green); }
    .mk.cur { background: var(--blue); border-color: var(--blue); }
    .dim { color: var(--muted); }
    .fine { margin-top: auto !important; padding: 24px 10px 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
    .stage { padding: 44px 64px 28px; display: flex; flex-direction: column; align-items: flex-start; min-width: 0; }
    .q { font-size: 46px; line-height: 1.08; margin-top: 22px !important; max-width: 760px; }
    .cons { font-size: 18px; color: var(--text2); margin-top: 18px !important; max-width: 680px; line-height: 1.5; }
    .zoom { width: 100%; max-width: 780px; margin-top: 18px; }
    .choices { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
    .resolve { display: flex; flex-direction: column; gap: 10px; max-width: 640px; margin-top: 8px; }
    .resolve label { font-size: 18px; font-weight: 700; }
    .resolve label span { color: var(--text2); font-size: 13px; font-weight: 500; }
    .resolve textarea { padding: 14px 16px; border: 1px solid var(--surface2); border-radius: 18px; background: var(--bg); color: var(--text); font: inherit; resize: vertical; }
    .resolve-actions { display: flex; gap: 10px; }
    .choice { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 18px 24px; border-radius: 28px; border: 1px solid var(--surface2); background: var(--bg); cursor: pointer; text-align: left; min-width: 150px; }
    .choice:hover { filter: brightness(.97); }
    .choice strong { font-size: 20px; letter-spacing: -0.02em; }
    .choice span { font-size: 13px; color: var(--text2); }
    .choice.primary { background: var(--blue); border-color: var(--blue); color: #fff; }
    .choice.primary span { color: rgba(255, 255, 255, .85); }
    .foot { margin-top: auto; padding-top: 40px; display: flex; align-items: center; gap: 18px; font-size: 14px; color: var(--muted); }
    .back { color: var(--muted); cursor: pointer; font-size: 14px; }
    .dots { display: inline-flex; gap: 6px; }
    .dots i { width: 9px; height: 9px; border-radius: 50%; background: var(--surface2); }
    .dots i.done { background: var(--green); }
    .dots i.cur { background: var(--pink); }
    .confirm { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; padding-top: 40px; max-width: 720px; }
    .confirm h2 { font-size: 40px; line-height: 1.1; }
    .confirm-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 10px; }
    .all { font-size: 16px; color: var(--text2); margin-right: 8px !important; }
    @media (max-width: 900px) {
      .body { grid-template-columns: 1fr; }
      .list { display: none; }
      .stage { padding: 28px 16px 24px; }
      .q { font-size: 32px; }
      .top { padding: 14px 16px; }
      .meta { display: none; }
      .top h1 { margin-right: auto; }
      .choice { flex: 1 1 140px; }
    }
  `],
} )
export class ReviewComponent implements OnInit {
  readonly store = inject( FlowStore );
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  readonly logo = MOVES_ICON;
  readonly today = fmtDay( new Date() );

  /** Snapshot when the review opens, so decided items stay in the list with a tick. */
  readonly items = signal<Issue[]>( [] );
  readonly index = signal( 0 );
  readonly decided = signal<Record<string, string>>( {} );
  /** The issue whose "I handled it" note is open. */
  readonly resolving = signal<string | null>( null );
  readonly resolveNote = signal( '' );
  readonly confirm = computed( () => this.decided()[this.current()?.id || ''] || '' );

  readonly current = computed( () => this.items()[this.index()] );
  readonly projectCount = computed( () => new Set( this.items().map( i => i.projectId ).filter( Boolean ) ).size );
  readonly fixedCount = computed( () => {
    const s = this.store.state();
    return liveActions( s ).filter( a => a.auto && daysBetween( a.createdAt, s.now ) <= 1 ).length;
  } );
  readonly nextOpen = computed( () => {
    const list = this.items();
    for ( let k = 1; k <= list.length; k++ ) {
      const n = ( this.index() + k ) % list.length;
      if ( !this.isDone( list[n] ) ) return n;
    }
    return null;
  } );

  readonly zoom = computed( () => {
    const i = this.current();
    if ( !i ) return null;
    const s = this.store.state();
    const focus = i.moveIds.map( id => moveById( s, id ) ).filter( ( m ): m is FlowMove => !!m );
    const moves = i.kind === 'pileup' || i.kind === 'capacity' || !i.projectId ? focus : projectMoves( s, i.projectId );
    if ( !moves.length ) return null;
    const anchor = focus[0] || moves[0];
    const r = { start: addDays( anchor.due, -12 ), end: addDays( anchor.due, 12 ) };
    const model = trackFor( s, moves, this.store.issues(), r );
    return { ...model, nodes: model.nodes.map( n => ( { ...n, label: undefined } ) ), stall: undefined };
  } );

  ngOnInit (): void {
    const open = this.store.needsYou();
    const parked = this.store.issues().filter( i => isParked( this.store.state(), i.id ) );
    const list = [...open, ...parked.filter( p => !open.some( o => o.id === p.id ) )];
    this.items.set( list );
    const focus = this.route.snapshot.queryParamMap.get( 'item' );
    const at = focus ? list.findIndex( i => i.id === focus ) : -1;
    this.index.set( at >= 0 ? at : 0 );
  }

  isDone ( i: Issue ): boolean {
    return !!this.decided()[i.id];
  }

  go ( n: number ): void {
    if ( n >= 0 && n < this.items().length ) this.index.set( n );
  }

  where ( i: Issue ): string {
    if ( i.kind === 'pileup' ) return 'Marketing Assistant';
    return this.store.project( i.projectId )?.name || 'Team';
  }

  kind ( i: Issue ): string {
    return KIND_LABEL[i.kind];
  }

  choose ( c: IssueChoice ): void {
    const i = this.current();
    if ( !i ) return;
    if ( c.run.kind === 'open' ) {
      this.openMove( c.run.moveId );
      return;
    }
    if ( c.run.kind === 'done' ) {
      this.resolveNote.set( '' );
      this.resolving.set( i.id );
      return;
    }
    const before = this.store.state().actions.length;
    this.store.run( c, i );
    // The write prompt may have stopped it (live mode without write access).
    const ran = this.store.state().actions.length > before || ['keep', 'park', 'skip'].includes( c.run.kind );
    if ( !ran ) return;
    const msg = this.store.toast()?.msg || 'Done.';
    this.decided.update( d => ( { ...d, [i.id]: msg } ) );
  }

  /** Saves the note (if any) and closes the move. */
  async finishResolve (): Promise<void> {
    const i = this.current();
    const c = i?.choices.find( x => x.run.kind === 'done' );
    if ( !i || !c || c.run.kind !== 'done' ) return;
    const before = this.store.state().actions.length;
    await this.store.resolve( c.run.moveId, this.resolveNote() );
    if ( this.store.state().actions.length <= before ) return;
    this.resolving.set( null );
    const msg = this.store.toast()?.msg || 'Done.';
    this.decided.update( d => ( { ...d, [i.id]: msg } ) );
  }

  openMove ( id: string ): void {
    void this.router.navigate( [], { queryParams: { move: id }, queryParamsHandling: 'merge' } );
  }

  async share (): Promise<void> {
    const lines = this.items().map( i => `${this.isDone( i ) ? '✓' : '•'} ${this.where( i )}: ${i.label}${this.isDone( i ) ? ` — ${this.decided()[i.id]}` : ''}` );
    const text = `Weekly review, ${this.today}\n${lines.join( '\n' )}`;
    try {
      await navigator.clipboard.writeText( text );
      this.store.say( 'Copied for standup. Paste it in your channel.' );
    } catch {
      this.store.say( 'Couldn’t copy. Your browser blocked the clipboard.' );
    }
  }

  @HostListener( 'document:keydown', ['$event'] )
  onKey ( e: KeyboardEvent ): void {
    const t = e.target as HTMLElement;
    if ( t?.closest( 'input, textarea, [role="dialog"]' ) || this.confirm() || this.resolving() ) return;
    const n = Number( e.key );
    const c = this.current()?.choices[n - 1];
    if ( c ) {
      e.preventDefault();
      this.choose( c );
    }
  }
}
