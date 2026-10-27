import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { daysBetween, fmtDue } from '../flow-dates';
import { firstName, isOpen, liveActions, moveById, ownerOf, personById } from '../flow-engine';
import { FlowMove } from '../flow.models';
import { FlowStore } from '../flow.store';
import { DemoNoticeComponent } from '../ui/demo-notice.component';
import { AvatarComponent, MOVES_ICON } from '../ui/flow-ui.components';

/** 09 Mobile, team member - "Luis, 3 next moves": the hand-off on top, Done / Can't do it. */
@Component( {
  selector: 'mv-my-moves',
  standalone: true,
  imports: [AvatarComponent, DemoNoticeComponent],
  template: `
    <div class="phone">
      <mv-demo-notice />
      <header class="top">
        <img [src]="logo" alt="Moves" class="logo">
        <mv-avatar [person]="me()" [size]="44" />
      </header>
      <h1>{{ first() }}, {{ moves().length }} next move{{ moves().length === 1 ? '' : 's' }}</h1>

      @if (lead(); as m) {
        <article class="lead">
          <div class="tags">
            @if (isNew()) { <span class="mv-tag mv-tag--blue mv-tag--lg">New from TODD</span> }
            <span class="mv-tag mv-tag--outline">Due {{ due(m) }}</span>
          </div>
          <h2>{{ m.title }}</h2>
          <p>Next: {{ lower(m.nextAction) || 'write down what happens next' }}.{{ after(m) }}</p>
          <div class="btns">
            <button type="button" class="mv-btn mv-btn--primary big" (click)="store.markDone(m.id)">Done</button>
            <button type="button" class="mv-btn big ghost" (click)="sheet.set(true)">Can’t do it</button>
          </div>
        </article>
      }

      @for (m of rest(); track m.id) {
        <button type="button" class="item" (click)="open(m.id)">
          <span class="ring"></span>
          <span class="txt"><strong>{{ m.title }}</strong><span>{{ meta(m) }}</span></span>
        </button>
      } @empty {
        @if (!lead()) { <p class="none">Nothing on your plate. TODD will push the next one here.</p> }
      }

      @if (sheet() && lead(); as m) {
        <div class="scrim" (click)="sheet.set(false)"></div>
        <div class="sheet" role="dialog" aria-modal="true" aria-label="Why can't you do it?">
          <h3>Why can’t you do it?</h3>
          <div class="chips">
            <button type="button" (click)="cant(m.id, 'someone-else')">Someone else should</button>
            <button type="button" (click)="cant(m.id, 'blocked')">I’m blocked</button>
            <button type="button" (click)="cant(m.id, 'not-this-week')">Not this week</button>
          </div>
          <p>TODD routes it again and tells {{ pmFirst() }} only if the date moves.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .phone { max-width: 440px; margin: 0 auto; padding: 24px 20px 40px; min-height: 100vh; min-height: 100dvh; background: var(--bg); }
    .top { display: flex; justify-content: space-between; align-items: center; padding-top: 16px; }
    .logo { width: 30px; height: 30px; border-radius: 8px; background: #fff; }
    h1 { font-size: 34px; line-height: 1.05; margin: 22px 0 18px !important; }
    .lead { background: var(--surface); border-radius: 32px; padding: 18px 18px 18px; }
    .tags { display: flex; gap: 8px; }
    .lead h2 { font-size: 22px; margin-top: 12px !important; }
    .lead p { font-size: 15px; color: var(--text2); margin-top: 8px !important; line-height: 1.45; }
    .btns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
    .big { padding: 14px; font-size: 17px; }
    .ghost { background: transparent; }
    .item { display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; margin-top: 14px; padding: 16px 18px; border: 1px solid var(--surface2); border-radius: 28px; cursor: pointer; }
    .ring { width: 16px; height: 16px; flex: none; border-radius: 50%; border: 3px solid var(--n500); }
    .txt { display: flex; flex-direction: column; }
    .txt strong { font-size: 17px; }
    .txt span { font-size: 14px; color: var(--muted); }
    .none { font-size: 15px; color: var(--text2); margin-top: 20px; }
    .scrim { position: fixed; inset: 0; z-index: 50; background: var(--scrim); }
    .sheet { position: fixed; z-index: 51; left: 50%; transform: translateX(-50%); bottom: 16px; width: min(420px, calc(100vw - 32px)); background: #111317; color: #f2f4f8; border-radius: 32px; padding: 22px 20px 20px; }
    .sheet h3 { color: #f2f4f8; font-size: 20px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .chips button { border: 1px solid rgba(255, 255, 255, .35); border-radius: 999px; padding: 9px 16px; font-size: 15px; color: #f2f4f8; cursor: pointer; }
    .chips button:hover { background: rgba(255, 255, 255, .08); }
    .sheet p { font-size: 13px; color: rgba(242, 244, 248, .7); margin-top: 14px !important; }
  `],
} )
export class MyMovesComponent {
  readonly store = inject( FlowStore );
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  readonly logo = MOVES_ICON;
  readonly sheet = signal( false );

  /** Demo shows Luis; ?as=<id> previews anyone; signed in it's you. */
  private readonly meId = computed( () => this.route.snapshot.queryParamMap.get( 'as' ) || ( this.store.isDemo() ? 'luis' : this.store.state().pmId ) );
  readonly me = computed( () => personById( this.store.state(), this.meId() ) );
  readonly first = computed( () => firstName( this.me() ) );
  readonly pmFirst = computed( () => firstName( this.store.pm() ) );

  readonly moves = computed( () => {
    const s = this.store.state();
    return s.moves.filter( m => isOpen( m ) && m.lane === 'person' && m.assigneeId === this.meId() ).sort( ( a, b ) => a.due.localeCompare( b.due ) );
  } );
  /** The newest hand-off TODD made to me today, else the soonest move. */
  private readonly newest = computed( () => {
    const s = this.store.state();
    return liveActions( s )
      .filter( a => daysBetween( a.createdAt, s.now ) === 0 && a.changes.some( c => c.after?.assigneeId === this.meId() ) )
      .sort( ( a, b ) => b.createdAt.localeCompare( a.createdAt ) )
      .map( a => moveById( s, a.moveId ) ).find( ( m ): m is FlowMove => !!m && isOpen( m ) && m.assigneeId === this.meId() );
  } );
  readonly lead = computed( () => this.newest() || this.moves()[0] );
  readonly isNew = computed( () => !!this.newest() );
  readonly rest = computed( () => this.moves().filter( m => m.id !== this.lead()?.id ) );

  due ( m: FlowMove ): string {
    return fmtDue( m.due, this.store.state().now );
  }

  lower ( s: string ): string {
    return s ? s[0].toLowerCase() + s.slice( 1 ) : s;
  }

  after ( m: FlowMove ): string {
    const s = this.store.state();
    const next = s.moves.find( x => isOpen( x ) && x.dependsOn.includes( m.id ) && x.lane === 'maya' );
    return next ? ` Maya ${next.title.toLowerCase().includes( 'email' ) ? 'writes the email' : 'picks it up'} after.` : '';
  }

  meta ( m: FlowMove ): string {
    const s = this.store.state();
    const project = this.store.project( m.projectId )?.name.split( ' ' )[0];
    const waits = m.dependsOn.map( id => moveById( s, id ) ).find( x => x && isOpen( x ) );
    return [project, this.due( m ), waits ? `waits on ${firstName( ownerOf( s, waits ) )}` : ''].filter( Boolean ).join( ' · ' );
  }

  cant ( id: string, reason: 'someone-else' | 'blocked' | 'not-this-week' ): void {
    this.sheet.set( false );
    this.store.cantDo( id, reason );
  }

  open ( id: string ): void {
    void this.router.navigate( [], { queryParams: { move: id }, queryParamsHandling: 'merge' } );
  }
}
