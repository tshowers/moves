import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { addDays, daysBetween, fmtDay, isoDay } from '../flow-dates';
import { byRoom, firstName, MAYA_ID } from '../flow-engine';
import { Lane, Person, TrackModel } from '../flow.models';
import { MovesSignupDraftService } from '../../services/moves-signup-draft.service';
import { FlowStore, PlanDraft } from '../flow.store';
import { DemoNoticeComponent } from '../ui/demo-notice.component';
import { FlowTrackComponent } from '../ui/flow-track.component';
import { MOVES_ICON, TODD_ICON } from '../ui/flow-ui.components';

interface Item { title: string; short: string; ownerName: string; ownerId: string | null; lane: Lane; nextAction: string }
interface Check { kind: 'order' | 'owner' | 'next'; glyph: string; lead: string; rest: string; fix: string; index: number[] }

const SAMPLE = `Fall campaign, launch Nov 16
- Messaging doc (Aisha)
- Press release
- Landing page (Sam)
- Ad creative, 6 sizes
- Messaging approved by Dana
- Email sequence
- Launch`;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const CONTENT = /creative|email|post|copy|\bads?\b|social|image|blog|newsletter|video/i;
const PUBLIC = /press|announce|publish/i;

/** 08 Onboarding - paste the plan you already have; TODD draws it as a line and checks it before anyone starts. */
@Component( {
  selector: 'mv-new-project',
  standalone: true,
  imports: [FormsModule, RouterLink, FlowTrackComponent, DemoNoticeComponent],
  template: `
    <div class="frame" data-cy="new-project">
      <mv-demo-notice class="notice" />
      <header class="top">
        <a routerLink="/app" class="brand"><img [src]="logo" alt="" class="logo"><span>New project</span></a>
        <ol class="steps">
          <li class="mv-tag" [class.mv-tag--green]="step() > 1" [class.mv-tag--blue]="step() === 1">1 Goal{{ step() > 1 ? ' ✓' : '' }}</li>
          <li class="mv-tag" [class.mv-tag--green]="step() > 2" [class.mv-tag--blue]="step() === 2" [class.mv-tag--outline]="step() < 2">2 Plan{{ step() > 2 ? ' ✓' : '' }}</li>
          <li class="mv-tag" [class.mv-tag--blue]="step() === 3" [class.mv-tag--outline]="step() < 3">3 Team &amp; rules</li>
        </ol>
      </header>

      @switch (step()) {
        @case (1) {
          <section class="goal">
            <h1 class="big">What are you shipping, and when?</h1>
            <label class="mv-label" for="np-name">Project</label>
            <input id="np-name" class="mv-input" [(ngModel)]="name" placeholder="Fall campaign">
            <label class="mv-label" for="np-date">Launch date</label>
            <input id="np-date" class="mv-input" type="date" [(ngModel)]="launch">
            <div class="row-actions"><button type="button" class="mv-btn mv-btn--dark mv-btn--lg" [disabled]="!name.trim()" (click)="toPlan()">Next: the plan</button></div>
          </section>
        }
        @case (2) {
          <div class="cols">
            <section class="left">
              <h1 class="big">Paste the plan you already have</h1>
              <p class="lede">A list, a doc or meeting notes. TODD turns it into moves and checks the order, the owners and the next actions before anyone starts.</p>
              <textarea class="paste" [ngModel]="text()" (ngModelChange)="text.set($event)" aria-label="Your plan" [placeholder]="sample"></textarea>
              <div class="row-actions">
                <label class="mv-btn upload">Upload a file<input type="file" accept=".txt,.md,.csv" (change)="upload($event)" hidden></label>
                <button type="button" class="mv-btn" (click)="text.set(sample)">Start from a template</button>
              </div>
            </section>
            <section class="right">
              <header class="rh">
                <img [src]="todd" alt="" class="mv-plate">
                <h2>{{ title() }}, as a line</h2>
                <span class="mv-muted">{{ items().length }} moves · {{ weeks() }} week{{ weeks() === 1 ? '' : 's' }}</span>
              </header>
              @if (items().length) {
                <div class="line"><mv-flow-track [model]="track()" [showToday]="false" [clickable]="false" /></div>
                <div class="mv-label">Before you start · {{ checks().length }} thing{{ checks().length === 1 ? '' : 's' }}</div>
                @for (c of checks(); track c.lead) {
                  <div class="check">
                    <span class="glyph" [class]="'glyph glyph--' + c.kind">{{ c.glyph }}</span>
                    @if (writing() === c.index[0] && c.kind === 'next') {
                      <input class="mv-input" [(ngModel)]="nextDraft" (keydown.enter)="saveNext(c.index[0])" placeholder="What has to happen?" aria-label="Next action">
                      <button type="button" class="mv-btn mv-btn--primary" (click)="saveNext(c.index[0])">Save</button>
                    } @else {
                      <p><strong>{{ c.lead }}</strong> {{ c.rest }}</p>
                      <button type="button" class="mv-btn" [class.mv-btn--primary]="c.kind !== 'next'" (click)="fix(c)">{{ c.fix }}</button>
                    }
                  </div>
                } @empty {
                  <p class="clean">Every move has an owner, a next action and a sane order.</p>
                }
              } @else {
                <p class="clean">Paste a list on the left. One move per line.</p>
              }
              <div class="row-actions end">
                <button type="button" class="mv-btn mv-btn--lg" [disabled]="!items().length || busy()" (click)="create()">Start anyway</button>
                <button type="button" class="mv-btn mv-btn--dark mv-btn--lg" [disabled]="!items().length" (click)="step.set(3)">Next: team &amp; rules</button>
              </div>
            </section>
          </div>
        }
        @case (3) {
          <section class="team">
            <h1 class="big">Who does what</h1>
            <p class="lede">TODD hands Maya the content moves and nudges everyone else within its rules.</p>
            <div class="owners">
              @for (it of items(); track $index; let n = $index) {
                <div class="owner-row">
                  <strong>{{ it.title }}</strong>
                  <select class="mv-input" [ngModel]="it.lane === 'maya' ? maya : it.ownerId || ''" (ngModelChange)="setOwner(n, $event)" [attr.aria-label]="'Owner of ' + it.title">
                    <option value="">No owner yet</option>
                    @for (p of owners(); track p.id) { <option [value]="p.id">{{ p.name }}</option> }
                  </select>
                </div>
              }
            </div>
            <div class="mv-label rules-label">TODD’s rules for this project</div>
            <ul class="rules">
              @for (r of store.state().rules; track r.id) {
                <li [class.off]="!r.enabled"><strong>{{ r.lead }}</strong> {{ r.text }}</li>
              }
            </ul>
            <div class="row-actions">
              <button type="button" class="mv-btn mv-btn--lg" (click)="step.set(2)">Back</button>
              <button type="button" class="mv-btn mv-btn--primary mv-btn--lg" [disabled]="busy()" (click)="create()">Create project</button>
            </div>
          </section>
        }
      }
    </div>
  `,
  styles: [`
    .notice { padding-top: 16px; }
    .frame { min-height: 100vh; min-height: 100dvh; background: var(--bg); padding: 0 32px 32px; }
    .top { display: flex; align-items: center; justify-content: space-between; padding: 22px 0; gap: 12px; flex-wrap: wrap; }
    .brand { display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--text); font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .logo { width: 30px; height: 30px; border-radius: 8px; background: #fff; }
    .steps { display: flex; gap: 8px; list-style: none; margin: 0; padding: 0; }
    .steps .mv-tag { font-size: 13px; padding: 5px 12px; }
    .big { font-size: 34px; line-height: 1.1; }
    .lede { font-size: 15px; color: var(--text2); margin-top: 12px !important; max-width: 440px; line-height: 1.5; }
    .goal, .team { max-width: 620px; margin: 30px auto 0; display: flex; flex-direction: column; gap: 10px; }
    .goal .mv-label { margin-top: 14px; }
    .cols { display: grid; grid-template-columns: 420px minmax(0, 1fr); gap: 28px; }
    .left { display: flex; flex-direction: column; padding-top: 6px; }
    .paste { flex: 1; min-height: 360px; margin-top: 22px; border: 0; border-radius: 28px; background: var(--surface); color: var(--text); padding: 20px 18px; font-family: ui-monospace, Menlo, monospace; font-size: 15px; line-height: 1.55; resize: vertical; }
    .row-actions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
    .row-actions.end { margin-top: auto; padding-top: 24px; justify-content: flex-end; }
    .upload { cursor: pointer; }
    .right { background: var(--surface); border-radius: 32px; padding: 22px 26px 26px; display: flex; flex-direction: column; gap: 12px; min-height: 560px; }
    .rh { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .rh img { width: 40px; height: 40px; border-radius: 50%; }
    .rh h2 { font-size: 24px; margin-right: auto !important; }
    .rh span { font-size: 13px; }
    .line { background: var(--bg); border-radius: 24px; padding: 16px 30px 4px; margin-bottom: 8px; }
    .check { display: flex; align-items: center; gap: 14px; background: var(--bg); border-radius: 20px; padding: 12px 16px; }
    .check p { flex: 1; font-size: 14px; line-height: 1.4; }
    .check .mv-input { flex: 1; }
    .glyph { width: 22px; text-align: center; font-weight: 700; font-size: 15px; flex: none; }
    .glyph--order { color: var(--violet); }
    .glyph--owner, .glyph--next { color: var(--t-pink-fg); }
    .clean { font-size: 14px; color: var(--text2); }
    .owners { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
    .owner-row { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 12px; align-items: center; background: var(--surface); border-radius: 18px; padding: 8px 8px 8px 16px; }
    .owner-row strong { font-size: 14px; }
    .rules-label { margin-top: 20px; }
    .rules { margin: 4px 0 0; padding-left: 18px; font-size: 14px; color: var(--text2); line-height: 1.6; }
    .rules li.off { opacity: .5; text-decoration: line-through; }
    @media (max-width: 960px) {
      .frame { padding: 0 16px 24px; }
      .cols { grid-template-columns: 1fr; }
      .paste { min-height: 220px; }
      .right { min-height: 0; padding: 18px 16px; }
      .line { padding: 16px 12px 4px; overflow-x: auto; }
      .line mv-flow-track { min-width: 520px; }
      .check { flex-wrap: wrap; }
      .owner-row { grid-template-columns: 1fr; }
    }
  `],
} )
export class NewProjectComponent implements OnInit {
  readonly store = inject( FlowStore );
  private readonly router = inject( Router );
  private readonly signupDraft = inject( MovesSignupDraftService );
  /** Started from the /get-started wizard's drafted Move: clear it once the project exists. */
  private fromSignup = false;
  readonly logo = MOVES_ICON;
  readonly todd = TODD_ICON;
  readonly sample = SAMPLE;
  readonly maya = MAYA_ID;

  readonly step = signal( 1 );
  readonly text = signal( '' );
  readonly busy = signal( false );
  readonly writing = signal<number | null>( null );
  /** Fixes the PM tapped, applied on top of the parse. */
  private readonly overrides = signal<Record<number, Partial<Item>>>( {} );
  private readonly moved = signal<number[]>( [] );
  name = '';
  launch = '';
  nextDraft = '';

  readonly owners = computed( () => this.store.state().people.filter( p => p.kind !== 'todd' ) );

  private readonly parsed = computed( () => this.parse( this.text() ) );
  readonly title = computed( () => this.parsed().title || this.name || 'Your project' );
  readonly launchDate = computed( () => this.parsed().launch || this.launch || isoDay( addDays( new Date(), 35 ) ) );
  readonly weeks = computed( () => Math.max( 1, Math.round( daysBetween( new Date(), this.launchDate() ) / 7 ) ) );

  readonly items = computed<Item[]>( () => {
    const base = this.parsed().items.map( ( it, n ) => ( { ...it, ...this.overrides()[n] } ) );
    // "Move it" fixes: an item TODD moved after the approval.
    for ( const n of this.moved() ) {
      const approval = base.findIndex( i => /approv/i.test( i.title ) );
      const [it] = base.splice( n, 1 );
      base.splice( approval >= 0 ? approval : base.length, 0, it );
    }
    return base;
  } );

  readonly checks = computed<Check[]>( () => {
    const items = this.items();
    const out: Check[] = [];
    const approval = items.findIndex( i => /approv/i.test( i.title ) );
    const early = items.map( ( it, n ) => ( { it, n } ) ).filter( ( { it, n } ) => approval > 0 && n < approval && PUBLIC.test( it.title ) );
    for ( const { it, n } of early ) {
      const subject = items.slice( 0, approval ).find( i => !PUBLIC.test( i.title ) )?.short.toLowerCase() || 'the plan';
      out.push( { kind: 'order', glyph: '⇄', lead: `${it.short} comes before ${subject} is approved.`, rest: 'Move it after approval?', fix: 'Move it', index: [n] } );
    }
    const noOwner = items.map( ( it, n ) => ( { it, n } ) ).filter( ( { it, n } ) => !it.ownerId && it.lane === 'person' && n < items.length - 1 && !early.some( e => e.n === n ) );
    if ( noOwner.length ) {
      const content = noOwner.every( ( { it } ) => CONTENT.test( it.title ) );
      const names = noOwner.map( ( { it }, k ) => k ? it.short.toLowerCase() : it.short );
      const who = content ? 'Maya' : firstName( this.suggest() );
      const approver = items.find( i => /approv/i.test( i.title ) && i.ownerId );
      out.push( {
        kind: 'owner', glyph: '?', lead: `${names.join( ' and ' )} ${noOwner.length === 1 ? 'has' : 'have'} no owner.`,
        rest: content ? `Maya can do ${noOwner.length === 1 ? 'it' : noOwner.length === 2 ? 'both' : 'all of them'}.${approver ? ` ${firstName( this.person( approver.ownerId ) )} approves.` : ''}` : `${who} has the most room.`,
        fix: `Give to ${who}`, index: noOwner.map( x => x.n ),
      } );
    }
    items.forEach( ( it, n ) => {
      if ( !it.nextAction.trim() ) out.push( { kind: 'next', glyph: '!', lead: `“${it.title}” has no next action.`, rest: `What has to happen on ${fmtDay( this.dueFor( n ) )}?`, fix: 'Write it', index: [n] } );
    } );
    return out;
  } );

  readonly track = computed<TrackModel>( () => {
    const items = this.items();
    const checks = this.checks();
    const kindOf = ( n: number ) => checks.find( c => c.kind === 'order' && c.index.includes( n ) ) ? 'order' as const : checks.find( c => c.kind === 'owner' && c.index.includes( n ) ) ? 'gap' as const : 'upcoming' as const;
    return {
      today: null, progress: 0,
      nodes: items.map( ( it, n ) => ( { id: String( n ), x: items.length === 1 ? 0.5 : 0.02 + ( n / ( items.length - 1 ) ) * 0.96, kind: kindOf( n ), label: it.short } ) ),
    };
  } );

  ngOnInit (): void {
    const drafted = this.signupDraft.planText();
    if ( drafted && !this.store.isDemo() ) {
      this.fromSignup = true;
      this.text.set( drafted );
      this.name = this.signupDraft.pendingTitle();
      this.step.set( 2 );
      return;
    }
    if ( this.store.isDemo() ) {
      this.text.set( SAMPLE );
      this.name = 'Fall campaign';
      this.step.set( 2 );
    }
  }

  toPlan (): void {
    this.step.set( 2 );
  }

  person ( id: string | null ): Person | undefined {
    return this.store.state().people.find( p => p.id === id );
  }

  suggest (): Person | undefined {
    return byRoom( this.store.state(), '' )[0];
  }

  dueFor ( n: number ): string {
    const total = this.items().length;
    const span = Math.max( total, daysBetween( new Date(), this.launchDate() ) );
    return isoDay( addDays( new Date(), total <= 1 ? span : Math.round( 2 + ( n / ( total - 1 ) ) * ( span - 2 ) ) ) );
  }

  fix ( c: Check ): void {
    if ( c.kind === 'order' ) {
      // Overrides are keyed by parsed index, so fixes stay with a moved item.
      this.moved.update( m => [...m, c.index[0]] );
    } else if ( c.kind === 'owner' ) {
      const content = c.fix === 'Give to Maya';
      const who = this.suggest();
      this.overrides.update( o => {
        const next = { ...o };
        for ( const n of c.index.map( i => this.parsedIndexOf( i ) ) ) next[n] = { ...next[n], ...( content ? { lane: 'maya' as Lane, ownerId: null } : { ownerId: who?.id || null } ) };
        return next;
      } );
    } else {
      this.nextDraft = '';
      this.writing.set( c.index[0] );
    }
  }

  saveNext ( n: number ): void {
    const text = this.nextDraft.trim();
    this.writing.set( null );
    if ( !text ) return;
    const parsedIndex = this.parsedIndexOf( n );
    this.overrides.update( o => ( { ...o, [parsedIndex]: { ...o[parsedIndex], nextAction: text } } ) );
  }

  setOwner ( n: number, id: string ): void {
    const parsedIndex = this.parsedIndexOf( n );
    const patch: Partial<Item> = id === MAYA_ID ? { lane: 'maya', ownerId: null } : { lane: 'person', ownerId: id || null };
    this.overrides.update( o => ( { ...o, [parsedIndex]: { ...o[parsedIndex], ...patch } } ) );
  }

  /** Display index -> parsed index, undoing any "Move it" reorders. */
  private parsedIndexOf ( n: number ): number {
    const order = this.parsed().items.map( ( _, i ) => i );
    for ( const m of this.moved() ) {
      const approval = this.parsed().items.findIndex( i => /approv/i.test( i.title ) );
      const [it] = order.splice( m, 1 );
      order.splice( approval >= 0 ? approval : order.length, 0, it );
    }
    return order[n] ?? n;
  }

  upload ( e: Event ): void {
    const file = ( e.target as HTMLInputElement ).files?.[0];
    if ( !file ) return;
    file.text().then( t => this.text.set( t ) ).catch( () => this.store.say( 'Couldn’t read that file. Try a .txt or .md file.' ) );
  }

  async create (): Promise<void> {
    if ( this.busy() ) return;
    this.busy.set( true );
    const items = this.items();
    const draft: PlanDraft = {
      name: this.title(),
      launch: this.launchDate(),
      moves: items.map( ( it, n ) => ( {
        title: it.title, ownerId: it.lane === 'person' ? ( it.ownerId || ( n === items.length - 1 ? this.store.state().pmId : null ) ) : null,
        lane: it.lane, due: this.dueFor( n ), nextAction: it.nextAction, dependsOn: n ? [n - 1] : [],
      } ) ),
    };
    const id = await this.store.createProject( draft );
    this.busy.set( false );
    if ( id && this.fromSignup ) this.signupDraft.clear();
    if ( id ) void this.router.navigate( ['/app/projects', id] );
  }

  private parse ( text: string ): { title: string; launch: string; items: Item[] } {
    const lines = text.split( /\r?\n/ ).map( l => l.trim() ).filter( Boolean );
    let title = '';
    let launch = '';
    const items: Item[] = [];
    for ( const line of lines ) {
      const bullet = /^([-*•]|\d+[.)])\s+/.test( line );
      const body = line.replace( /^([-*•]|\d+[.)])\s+/, '' );
      if ( !bullet && !title && !items.length ) {
        const date = this.findDate( body );
        if ( date ) launch = date;
        title = body.replace( /,?\s*(launch(es)?|ships?|due|by)\s+[a-z]{3,9}\.?\s+\d{1,2}.*$/i, '' ).trim();
        continue;
      }
      const owner = /\(([^)]+)\)\s*$/.exec( body )?.[1] || /approved by\s+(\w+)/i.exec( body )?.[1] || '';
      const clean = body.replace( /\s*\([^)]*\)\s*$/, '' ).trim();
      const ownerId = owner ? this.store.state().people.find( p => p.kind === 'person' && firstName( p ).toLowerCase() === owner.split( ' ' )[0].toLowerCase() )?.id || null : null;
      const short = /approved by/i.test( clean ) ? 'Approval' : clean.split( ',' )[0].replace( /\s+doc$/i, '' ).replace( /\s+sequence$/i, 's' );
      const oneWord = clean.split( /\s+/ ).length === 1;
      items.push( { title: clean, short, ownerName: owner, ownerId, lane: 'person', nextAction: oneWord ? '' : clean } );
    }
    return { title, launch, items };
  }

  private findDate ( text: string ): string {
    const m = /([a-z]{3})[a-z]*\.?\s+(\d{1,2})/i.exec( text );
    if ( !m ) return '';
    const month = MONTHS.indexOf( m[1].toLowerCase() );
    if ( month < 0 ) return '';
    const now = new Date();
    let d = new Date( now.getFullYear(), month, Number( m[2] ) );
    if ( d < addDays( now, -1 ) ) d = new Date( now.getFullYear() + 1, month, Number( m[2] ) );
    return isoDay( d );
  }
}

