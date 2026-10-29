import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { fmtDay, fmtDue, fmtWeekdayDay } from '../flow-dates';
import {
  criticalPath, firstName, forecast, issuesForProject, loadOf, MAYA_ID, nextActionsSet, ownerOf, phaseTrack, projectHealth,
  projectMoves, sequenceProposal, TODD_ID,
} from '../flow-engine';
import { FlowMove } from '../flow.models';
import { FlowStore } from '../flow.store';
import { FlowTrackComponent } from '../ui/flow-track.component';
import { AvatarComponent, TODD_ICON } from '../ui/flow-ui.components';
import { IssueCardComponent, LogRowsComponent } from '../ui/issue-card.component';

type Tab = 'flow' | 'sequence' | 'moves' | 'people' | 'log';

/** 02 Project health + 03 Sequence: one project's line, its order, its moves, its people, its log. */
@Component( {
  selector: 'mv-project',
  standalone: true,
  imports: [RouterLink, FlowTrackComponent, IssueCardComponent, LogRowsComponent, AvatarComponent],
  template: `
    @if (project(); as p) {
      <div class="layout" [class.wide]="tab() === 'sequence'">
        <div class="mv-page body">
          <div class="mv-crumb"><a routerLink="/app">Projects</a> › {{ p.name }}
            @if (!p.orphan && !renaming() && !deleting()) {
              <!-- Rename / delete, out of the way (2026-10-27). -->
              <span class="manage">
                <button type="button" class="mv-link" (click)="startRename(p.name)" data-cy="project-rename">Rename</button>
                <button type="button" class="mv-link" (click)="deleting.set(true)" data-cy="project-delete">Delete</button>
              </span>
            }
          </div>
          @if (renaming()) {
            <form class="rename" (submit)="$event.preventDefault(); saveRename(p.id)">
              <input class="mv-input" [value]="nameDraft()" (input)="nameDraft.set($any($event.target).value)" (keydown.escape)="renaming.set(false)" aria-label="Project name" data-cy="project-name-input">
              <button type="submit" class="mv-btn mv-btn--primary mv-btn--sm">Save</button>
              <button type="button" class="mv-btn mv-btn--sm" (click)="renaming.set(false)">Cancel</button>
            </form>
          } @else {
            <h1 class="mv-title">{{ p.name }}</h1>
          }
          @if (deleting()) {
            <div class="confirm-delete" role="alert" data-cy="project-delete-confirm">
              <p>Delete <strong>{{ p.name }}</strong>?{{ openCount() ? ' Its ' + openCount() + ' open move' + (openCount() === 1 ? '' : 's') + ' stay, out of any project.' : ' It has no open moves.' }}</p>
              <button type="button" class="mv-btn mv-btn--primary mv-btn--sm" (click)="remove(p.id)">Delete project</button>
              <button type="button" class="mv-btn mv-btn--sm" (click)="deleting.set(false)">Cancel</button>
            </div>
          }
          @if (tab() !== 'sequence') {
            <div class="tags">
              @if (health().tone !== 'green') { <span class="mv-tag mv-tag--lg" [class.mv-tag--pink]="health().tone === 'pink'">{{ health().label.split(' · ')[0] }}</span> }
              @else { <span class="mv-tag mv-tag--lg mv-tag--green">Moving</span> }
              @if (p.shipsOn) { <span class="mv-tag mv-tag--outline">Ships {{ fmtDay(p.shipsOn) }}</span> }
              <span class="mv-tag mv-tag--outline">{{ p.memberIds.length }} {{ p.memberIds.length === 1 ? 'person' : 'people' }}{{ hasMaya() ? ' · the Marketing Assistant' : '' }}</span>
              @if (p.client) { <span class="client">{{ p.client }} · {{ p.value }}</span> }
            </div>
          }
          <nav class="mv-tabs" aria-label="Project">
            @for (t of tabs; track t.key) {
              <a [routerLink]="['/app/projects', p.id, t.key === 'flow' ? '' : t.key]" [class.on]="tab() === t.key">{{ t.label }}</a>
            }
          </nav>

          @switch (tab()) {
            @case ('flow') {
              <section class="band">
                @if (phased().phases.length) {
                  <div class="phases">
                    @for (ph of phased().phases; track ph.label) {
                      <div class="phase" [style.left.%]="ph.x * 100"><span class="mv-label">{{ ph.label }}</span></div>
                    }
                  </div>
                }
                <mv-flow-track [model]="phased().model" [todayLabel]="true" (nodeClick)="open($event)" />
              </section>
              <div class="summary">
                <div class="mv-card sum"><div class="mv-label">Forecast</div><h3>{{ fc().title }}</h3><p>{{ fc().text }}</p></div>
                <div class="mv-card sum"><div class="mv-label">Critical path</div><h3>{{ critical() || 'Nothing open' }}</h3><p>{{ critical() ? 'Every other move has slack.' : 'All moves are done.' }}</p></div>
                <div class="mv-card sum"><div class="mv-label">Next actions</div><h3>{{ na().set }} of {{ na().total }} set</h3><p>{{ naText() }}</p></div>
              </div>
            }
            @case ('sequence') {
              <div class="mv-label seq-label">Current order</div>
              <div class="order">
                @for (m of moves(); track m.id; let last = $last) {
                  <button type="button" class="oc" [class.done]="m.done" [class.clash]="clash().includes(m.id)" (click)="open(m.id)">
                    <span class="meta">{{ m.done ? 'Done' : weekdayDay(m.due) }} · {{ ownerName(m) }}</span>
                    <strong>{{ m.title }}</strong>
                  </button>
                  @if (!last) { <span class="arrow">→</span> }
                }
              </div>
              @if (proposal(); as pr) {
                <p class="why">↰ {{ pr.issue.consequence.split('.')[0] }}</p>
                <section class="proposal">
                  <header>
                    <img [src]="todd" alt="" class="mv-icon mv-plate">
                    <h2>Proposed order</h2>
                    @if (pr.waitingOn) { <span class="mv-tag mv-tag--pink">{{ pr.waitingOn }}</span> }
                  </header>
                  <div class="order">
                    @for (row of pr.proposed; track row.move.id; let last = $last) {
                      <div class="oc" [class.done]="row.move.done" [class.changed]="row.changed">
                        <span class="meta">{{ row.move.done ? 'Done' : weekdayDay(row.due) + ' · ' + ownerName(row.move) }}</span>
                        <strong>{{ row.move.title }}</strong>
                      </div>
                      @if (!last) { <span class="arrow">→</span> }
                    }
                  </div>
                  <div class="cols">
                    <div><h4>What changes</h4><p>{{ pr.whatChanges }}</p></div>
                    <div><h4>What stays</h4><p>{{ pr.whatStays }}</p></div>
                    <div><h4>Why I flagged it</h4><p>{{ pr.why }}</p></div>
                  </div>
                  <div class="seq-actions">
                    <button type="button" class="mv-btn mv-btn--primary mv-btn--lg" data-cy="sequence-apply" (click)="apply(pr.issue.id)">Apply{{ notifyNames(pr.notify) }}</button>
                    <button type="button" class="mv-btn mv-btn--lg" (click)="keep(pr.issue.id)">Keep current order</button>
                    @if (askWho(pr); as who) {
                      <button type="button" class="mv-btn mv-btn--lg" (click)="ask(pr.issue.moveIds[1])">Ask {{ who }}</button>
                    }
                  </div>
                </section>
              } @else {
                <p class="ok">The order checks out. Nothing is set before something it waits on.</p>
              }
            }
            @case ('moves') {
              <div class="table">
                @for (m of moves(); track m.id) {
                  <button type="button" class="tr" (click)="open(m.id)">
                    <span class="dotk" [class]="'dotk dotk--' + (m.done ? 'done' : ownerOf(m) ? 'open' : 'gap')"></span>
                    <span class="t"><strong>{{ m.title }}</strong><span>{{ m.nextAction || 'No next action' }}</span></span>
                    <span class="o">{{ ownerName(m) }}</span>
                    <span class="d">{{ m.done ? 'Done' : due(m.due) }}</span>
                  </button>
                } @empty { <p class="mv-empty">No moves yet.</p> }
              </div>
            }
            @case ('people') {
              <div class="table">
                @for (row of people(); track row.person.id) {
                  <div class="tr static">
                    <mv-avatar [person]="row.person" />
                    <span class="t"><strong>{{ row.person.name }}</strong><span>{{ row.person.role }}</span></span>
                    <span class="o">{{ row.here }} here</span>
                    @if (row.person.kind === 'person') {
                      <label class="d cap">{{ row.load }} of
                        <select [value]="row.person.capacity" (change)="setCapacity(row.person.id, $event)" [attr.aria-label]="'Room for ' + row.person.name">
                          @for (n of capacities; track n) { <option [value]="n" [selected]="n === row.person.capacity">{{ n }}</option> }
                        </select>
                      </label>
                    } @else {
                      <span class="d">{{ row.load }} of {{ row.person.capacity }} open</span>
                    }
                  </div>
                } @empty { <p class="mv-empty">Nobody owns a move here yet.</p> }
              </div>
            }
            @case ('log') {
              <mv-log-rows class="no-project" [actions]="log()" [showProject]="false" />
            }
          }
        </div>

        @if (tab() !== 'sequence') {
          <aside class="diag">
            <h2><img [src]="todd" alt="" class="mv-plate"> Diagnosis</h2>
            @for (i of diagnosis(); track i.id) {
              <mv-issue-card [issue]="i" />
            } @empty {
              <p class="quiet">Nothing to flag. Every move has an owner, a next action and a sane order.</p>
            }
          </aside>
        }
      </div>
    } @else {
      <div class="mv-page"><p class="mv-empty">That project isn’t here. <a routerLink="/app">Back to Momentum</a></p></div>
    }
  `,
  styles: [`
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; min-height: 100vh; }
    .layout.wide { grid-template-columns: minmax(0, 1fr); }
    .body { padding-top: 30px; }
    .mv-title { margin-top: 8px; }
    .manage { margin-left: 14px; display: inline-flex; gap: 12px; }
    .manage .mv-link { font-size: 13px; }
    .rename { display: flex; gap: 8px; align-items: center; margin-top: 8px; max-width: 640px; }
    .rename .mv-input { font-size: 24px; font-weight: 700; }
    .confirm-delete { margin-top: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 12px 16px; border-radius: 20px; background: var(--t-pink); color: var(--t-pink-fg); }
    .confirm-delete p { flex: 1; font-size: 14px; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 14px; }
    .tags .mv-tag--lg { padding: 5px 12px; }
    .client { font-size: 13px; color: var(--muted); padding-left: 2px; }
    .mv-tabs { margin-top: 22px; }
    .band { position: relative; margin-top: 20px; background: var(--surface); border-radius: 28px; padding: 50px 22px 24px; }
    .phases { position: absolute; inset: 20px 22px 16px; pointer-events: none; }
    .phase { position: absolute; top: 0; bottom: 0; border-left: 1px solid var(--surface2); padding-left: 0; }
    .phase:first-child { border-left: 0; }
    .phase .mv-label { position: relative; left: 0; }
    .phase:not(:first-child) .mv-label { margin-left: -1px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 20px; }
    .sum { border-radius: 24px; padding: 18px 18px 20px; }
    .sum h3 { font-size: 20px; line-height: 1.15; margin-top: 8px; }
    .sum p { font-size: 13px; color: var(--text2); margin-top: 6px; }
    .diag { background: var(--surface); padding: 30px 24px; display: flex; flex-direction: column; gap: 14px; }
    .diag h2 { display: flex; align-items: center; gap: 10px; font-size: 22px; margin-bottom: 4px; }
    .diag h2 img { width: 34px; height: 34px; }
    .quiet { font-size: 14px; color: var(--text2); }
    .seq-label { margin-top: 26px; margin-bottom: 14px; }
    .order { display: flex; align-items: center; gap: 12px; overflow-x: auto; padding: 4px 2px 6px; }
    .oc { flex: 1 1 0; display: flex; flex-direction: column; align-items: flex-start; text-align: left; gap: 2px; min-width: 104px; max-width: 170px; padding: 12px 16px; border-radius: 20px; border: 1px solid var(--surface2); background: var(--bg); cursor: pointer; }
    .oc.done { background: var(--surface); border-color: transparent; }
    .oc.clash { background: var(--t-pink); border: 2px solid var(--pink); }
    .oc.changed { background: var(--t-green); border: 2px solid var(--green); }
    .oc .meta { font-size: 12px; color: var(--muted); }
    .oc.clash .meta { color: var(--t-pink-fg); }
    .oc.changed .meta { color: var(--t-green-fg); }
    .oc strong { font-size: 15px; line-height: 1.25; color: var(--text); }
    .proposal .oc.done strong { color: var(--muted); }
    .arrow { color: var(--n500); font-size: 18px; flex: none; }
    .why { font-size: 13px; font-weight: 700; color: var(--t-pink-fg); margin: 10px 0 0 26%; }
    .proposal { margin-top: 22px; background: var(--surface); border-radius: 28px; padding: 22px 26px 26px; }
    .proposal header { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
    .proposal h2 { font-size: 24px; margin-right: auto; }
    .proposal .oc { background: var(--bg); border-color: transparent; }
    .proposal .oc.done { background: var(--bg); opacity: .7; }
    .proposal .oc.changed { background: var(--t-green); border: 2px solid var(--green); }
    .cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 18px; }
    .cols h4 { font-size: 14px; letter-spacing: 0; }
    .cols p { font-size: 14px; color: var(--text2); margin-top: 2px; }
    .seq-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
    .ok { margin-top: 18px; font-size: 15px; color: var(--text2); }
    .table { margin-top: 14px; display: flex; flex-direction: column; }
    .tr { display: grid; grid-template-columns: 34px minmax(0, 1fr) 140px 90px; gap: 14px; align-items: center; text-align: left; padding: 12px 6px; border-bottom: 1px solid var(--surface2); cursor: pointer; width: 100%; }
    .tr.static { cursor: default; }
    .tr:hover:not(.static) { background: var(--surface); }
    .t { display: flex; flex-direction: column; min-width: 0; }
    .t strong { font-size: 15px; }
    .t span { font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .o, .d { font-size: 14px; color: var(--text2); }
    .cap select { border: 1px solid var(--surface2); border-radius: 999px; background: var(--bg); color: var(--text); padding: 2px 8px; font: inherit; font-size: 13px; }
    .dotk { width: 14px; height: 14px; border-radius: 50%; justify-self: center; }
    .dotk--done { background: var(--green); }
    .dotk--open { border: 3px solid var(--n500); }
    .dotk--gap { border: 2px dashed var(--t-pink-fg); background: var(--t-pink); }
    @media (max-width: 1100px) {
      .layout { grid-template-columns: minmax(0, 1fr); }
      .diag { padding: 24px 36px 40px; }
    }
    @media (max-width: 720px) {
      .summary, .cols { grid-template-columns: 1fr; }
      .diag { padding: 20px 16px 40px; }
      .band { padding: 46px 12px 20px; overflow-x: auto; }
      .band mv-flow-track { min-width: 560px; }
      .why { margin-left: 0; }
      .tr { grid-template-columns: 24px minmax(0, 1fr) 70px; }
      .tr .o { display: none; }
    }
  `],
} )
export class ProjectComponent {
  readonly store = inject( FlowStore );
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  readonly todd = TODD_ICON;
  readonly fmtDay = fmtDay;
  readonly tabs: { key: Tab; label: string }[] = [
    { key: 'flow', label: 'Flow' }, { key: 'sequence', label: 'Sequence' }, { key: 'moves', label: 'Moves' }, { key: 'people', label: 'People' }, { key: 'log', label: 'Log' },
  ];

  private readonly params = toSignal( this.route.paramMap.pipe( map( p => ( { id: p.get( 'id' ) || '', tab: ( p.get( 'tab' ) || 'flow' ) as Tab } ) ) ), { initialValue: { id: '', tab: 'flow' as Tab } } );
  readonly tab = computed( () => this.params().tab );
  readonly project = computed( () => this.store.project( this.params().id ) );
  readonly moves = computed( () => projectMoves( this.store.state(), this.params().id ) );
  readonly issues = computed( () => issuesForProject( this.store.issues(), this.params().id ) );
  readonly health = computed( () => projectHealth( this.store.state(), this.project()!, this.store.issues() ) );
  readonly hasMaya = computed( () => this.moves().some( m => m.lane === 'maya' ) );
  readonly phased = computed( () => phaseTrack( this.store.state(), this.project()!, this.store.issues() ) );
  readonly fc = computed( () => forecast( this.store.state(), this.project()!, this.store.issues() ) );
  readonly critical = computed( () => criticalPath( this.store.state(), this.params().id ).map( m => m.short || m.title.split( ' ' )[0] ).slice( 0, 3 ).join( ' → ' ) );
  readonly na = computed( () => nextActionsSet( this.store.state(), this.params().id ) );
  readonly naText = computed( () => {
    const missing = this.na().missing;
    if ( !missing.length ) return 'Every open move has one.';
    return `${missing.slice( 0, 2 ).map( m => m.title ).join( ' and ' )} ${missing.length === 1 ? 'has' : 'have'} none.`;
  } );
  readonly diagnosis = computed( () => {
    const rank = { needs_you: 0, watching: 1, fixed: 2 };
    return [...this.issues()].sort( ( a, b ) => rank[a.status] - rank[b.status] );
  } );
  readonly orderIssue = computed( () => this.issues().find( i => i.kind === 'order' && i.status === 'needs_you' ) );
  readonly proposal = computed( () => {
    const i = this.orderIssue();
    return i ? sequenceProposal( this.store.state(), i ) : null;
  } );
  readonly clash = computed( () => this.orderIssue()?.moveIds || [] );
  readonly log = computed( () => [...this.store.state().actions].filter( a => a.projectId === this.params().id ).sort( ( a, b ) => b.createdAt.localeCompare( a.createdAt ) ) );
  readonly people = computed( () => {
    const s = this.store.state();
    const p = this.project();
    if ( !p ) return [];
    const ids = [...new Set( [...p.memberIds, ...this.moves().filter( m => m.lane !== 'person' ).map( m => m.lane === 'maya' ? MAYA_ID : TODD_ID )] )];
    return ids.map( id => s.people.find( x => x.id === id ) ).filter( ( x ): x is NonNullable<typeof x> => !!x ).map( person => ( {
      person, load: loadOf( s, person.id ).length, here: this.moves().filter( m => !m.done && ownerOf( s, m )?.id === person.id ).length,
    } ) );
  } );

  readonly renaming = signal( false );
  readonly deleting = signal( false );
  readonly nameDraft = signal( '' );
  readonly openCount = computed( () => this.moves().filter( m => !m.done ).length );

  startRename ( name: string ): void {
    this.nameDraft.set( name );
    this.renaming.set( true );
  }

  saveRename ( id: string ): void {
    this.renaming.set( false );
    this.store.renameProject( id, this.nameDraft() );
  }

  async remove ( id: string ): Promise<void> {
    this.deleting.set( false );
    if ( await this.store.deleteProject( id ) ) void this.router.navigate( ['/app'] );
  }

  readonly capacities = Array.from( { length: 15 }, ( _, i ) => i + 1 );

  setCapacity ( personId: string, e: Event ): void {
    this.store.setCapacity( personId, Number( ( e.target as HTMLSelectElement ).value ) );
  }

  ownerOf ( m: FlowMove ) { return ownerOf( this.store.state(), m ); }
  ownerName ( m: FlowMove ): string { return this.ownerOf( m ) ? firstName( this.ownerOf( m ) ) : 'No owner'; }
  weekdayDay ( d: string ): string { return fmtWeekdayDay( d ); }
  due ( d: string ): string { return fmtDue( d, this.store.state().now ); }

  notifyNames ( people: { name: string }[] ): string {
    return this.store.isDemo() && people.length ? ` and tell ${people.map( p => p.name.split( ' ' )[0] ).join( ' & ' )}` : '';
  }

  askWho ( pr: NonNullable<ReturnType<typeof sequenceProposal>> ): string {
    const dep = this.store.state().moves.find( m => m.id === pr.issue.moveIds[1] );
    const owner = dep && ownerOf( this.store.state(), dep );
    return owner && owner.kind === 'person' ? `${firstName( owner )} if ${fmtWeekdayDay( this.store.state().moves.find( m => m.id === pr.issue.moveIds[0] )!.due ).split( ' ' )[0]} works` : '';
  }

  open ( id: string ): void {
    void this.router.navigate( [], { queryParams: { move: id }, queryParamsHandling: 'merge' } );
  }

  apply ( issueId: string ): void {
    this.store.applySequence( issueId );
    void this.router.navigate( ['/app'] );
  }

  keep ( issueId: string ): void {
    this.store.run( { label: '', hint: '', run: { kind: 'keep', issueId } }, this.orderIssue() );
    void this.router.navigate( ['/app'] );
  }

  ask ( moveId: string ): void {
    this.open( moveId );
  }
}
