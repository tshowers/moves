import { Component, computed, input, output } from '@angular/core';

import { TrackModel, TrackNode } from '../flow.models';

/**
 * The line - a project (or a person) as moves against today. Breaks show
 * as node types: stalled (yellow, days still), gap (pink dashed "?"), out
 * of order (violet "⇄"), fixed by TODD (green "✓"). Built once, used on
 * every screen.
 */
@Component( {
  selector: 'mv-flow-track',
  standalone: true,
  template: `
    <div class="track" [class]="'track--' + size()" [class.track--named]="named()">
      <div class="line"></div>
      @if (model().progress > 0) {
        <div class="line line--done" [style.width.%]="model().progress * 100"></div>
      }
      @if (model().stall; as st) {
        <div class="line line--stall" [style.left.%]="st.from * 100" [style.width.%]="(st.to - st.from) * 100"></div>
      }
      @if (model().today !== null && showToday()) {
        <div class="today" [style.left.%]="model().today! * 100">
          @if (todayLabel()) { <span>Today</span> }
        </div>
      }
      @for (n of model().nodes; track n.id) {
        <button type="button" class="node" data-cy="flow-node" [attr.data-kind]="n.kind" [class]="'node node--' + n.kind" [style.left.%]="n.x * 100"
          [attr.aria-label]="aria(n)" [disabled]="!n.moveId || !clickable()" (click)="n.moveId && nodeClick.emit(n.moveId)">
          @switch (n.kind) {
            @case ('stalled') { <i>{{ n.text }}</i> }
            @case ('pileup') { <b></b><b></b><i>{{ n.text }}</i> }
            @case ('gap') { <i>?</i> }
            @case ('order') { <i>&#8644;</i> }
            @case ('fixed') { <i>&#10003;</i> }
          }
        </button>
        @if (n.label && size() !== 'mini') {
          <div class="label" data-cy="flow-label" [class]="'label label--' + n.kind" [style.left.%]="n.x * 100">
            <strong>{{ n.label }}</strong>
            @if (n.sublabel) { <span>{{ n.sublabel }}</span> }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; min-width: 0; }
    .track { position: relative; height: 76px; --y: 26px; --line: 4px; }
    .track--named { height: 96px; --y: 34px; }
    .track--lg { height: 140px; --y: 44px; --line: 5px; }
    .track--mini { height: 36px; --y: 18px; --line: 4px; }
    .track--row { height: 56px; --y: 28px; --line: 3px; }
    .line { position: absolute; left: 0; right: 0; top: calc(var(--y) - var(--line) / 2); height: var(--line); border-radius: 4px; background: var(--surface2); }
    .line--done { right: auto; background: var(--green); }
    .line--stall { right: auto; background: repeating-linear-gradient(90deg, var(--stall) 0 8px, transparent 8px 14px); }
    .today { position: absolute; top: -18px; bottom: -18px; width: 0; border-left: 2px dashed var(--blue); z-index: 1; }
    .today span { position: absolute; top: -4px; left: 0; transform: translate(-50%, -100%); font-size: 12px; font-weight: 700; color: var(--blue-ink); white-space: nowrap; }
    .node {
      position: absolute; top: var(--y); transform: translate(-50%, -50%); z-index: 2; padding: 0;
      width: 18px; height: 18px; border-radius: 50%; border: 0; background: var(--green); box-shadow: 0 0 0 3px var(--bg);
      display: flex; align-items: center; justify-content: center; cursor: pointer;
    }
    .node:disabled { cursor: default; }
    .node i { font-style: normal; font-weight: 700; font-size: 11px; line-height: 1; position: relative; }
    .node--upcoming { background: var(--bg); border: 3px solid var(--n500); }
    .node--stalled { width: 30px; height: 30px; background: var(--yellow); border: 0; box-shadow: 0 0 0 5px var(--t-yellow); }
    .node--stalled i { color: #0f1115; }
    .node--gap { width: 30px; height: 30px; background: var(--t-pink); border: 2.5px dashed var(--t-pink-fg); }
    .node--gap i { color: var(--t-pink-fg); font-size: 14px; }
    .node--order { width: 30px; height: 30px; background: var(--t-violet); border: 2.5px solid var(--violet); }
    .node--order i { color: var(--violet); font-size: 14px; }
    .node--fixed { width: 30px; height: 30px; background: var(--t-green); border: 2.5px solid var(--green); }
    .node--fixed i { color: var(--t-green-fg); font-size: 13px; }
    .node--pileup { width: 26px; height: 26px; background: var(--yellow); border: 0; }
    .node--pileup i { color: #0f1115; }
    .node--pileup b { position: absolute; width: 26px; height: 26px; border-radius: 50%; border: 2.5px solid var(--pink); background: var(--t-pink); top: 0; }
    .node--pileup b:nth-of-type(1) { left: -16px; }
    .node--pileup b:nth-of-type(2) { left: -8px; }
    .track--mini .node { width: 16px; height: 16px; }
    .track--mini .node--stalled, .track--mini .node--gap, .track--mini .node--order, .track--mini .node--fixed { width: 24px; height: 24px; }
    .track--mini .node--stalled { box-shadow: none; }
    .track--mini .node i { font-size: 10px; }
    .track--lg .node { width: 24px; height: 24px; }
    .track--lg .node--stalled, .track--lg .node--gap, .track--lg .node--order, .track--lg .node--fixed { width: 52px; height: 52px; }
    .track--lg .node i { font-size: 18px; }
    .label { position: absolute; top: calc(var(--y) + 20px); transform: translateX(-50%); text-align: center; white-space: nowrap; font-size: 12px; line-height: 1.3; color: var(--text2); z-index: 2; }
    .label strong { font-weight: 500; display: block; }
    .label span { display: block; color: var(--muted); }
    .label--gap, .label--order { color: var(--t-pink-fg); }
    .label--gap strong, .label--order strong, .label--fixed strong { font-weight: 700; }
    .label--fixed { color: var(--t-green-fg); }
    .track--named .label { font-size: 13px; white-space: normal; width: 92px; }
    .track--named .label strong { font-weight: 700; color: var(--text); }
    .track--named .label--gap strong, .track--named .label--gap span { color: var(--t-pink-fg); }
    .track--named .label--order strong { color: var(--t-violet-fg); }
  `],
} )
export class FlowTrackComponent {
  readonly model = input.required<TrackModel>();
  readonly size = input<'md' | 'lg' | 'mini' | 'row'>( 'md' );
  readonly showToday = input( true );
  readonly todayLabel = input( false );
  readonly clickable = input( true );
  readonly nodeClick = output<string>();

  /** Every node carries a label - the phase-banded project view. */
  readonly named = computed( () => this.model().nodes.some( n => !!n.sublabel ) );

  aria ( n: TrackNode ): string {
    const kinds: Record<string, string> = { done: 'done', upcoming: 'upcoming', stalled: `stalled ${n.text}`, gap: 'no owner', order: 'out of order', fixed: 'fixed by TODD', pileup: `${n.text} piled up` };
    return `${n.label || 'Move'}, ${kinds[n.kind]}`;
  }
}
