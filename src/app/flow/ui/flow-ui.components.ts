import { Component, computed, ElementRef, HostListener, inject, input, output } from '@angular/core';

import { FlowStore } from '../flow.store';
import { loadOf } from '../flow-engine';
import { Person } from '../flow.models';

// Lowercase: public/assets/todd-icon.png. (A TODD-icon.png twin used to collide with it
// on case-insensitive disks at build time, so the live site served neither name reliably.)
export const TODD_ICON = 'assets/todd-icon.png';
export const MAYA_ICON = 'assets/find/entities/maya/logo-bw-icon.png';
export const MOVES_ICON = 'assets/find/entities/moves/logo-bw-icon.png';

/** Initials on blue for people; the TODD and Maya marks for the assistants. */
@Component( {
  selector: 'mv-avatar',
  standalone: true,
  template: `
    @if (person(); as p) {
      @if (p.kind === 'person') {
        <span class="mv-avatar" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * .38">{{ p.initials }}</span>
      } @else {
        <span class="mv-avatar mv-avatar--plate" [style.width.px]="size()" [style.height.px]="size()">
          <img [src]="p.kind === 'todd' ? todd : maya" [alt]="p.name">
        </span>
      }
    } @else {
      <span class="mv-avatar mv-avatar--none" [style.width.px]="size()" [style.height.px]="size()">?</span>
    }
  `,
  styles: [':host { display: inline-flex; }'],
} )
export class AvatarComponent {
  readonly person = input<Person | undefined>();
  readonly size = input( 34 );
  readonly todd = TODD_ICON;
  readonly maya = MAYA_ICON;
}

/** "Other" / "Pick": everyone on the project, most room first. */
@Component( {
  selector: 'mv-person-picker',
  standalone: true,
  imports: [AvatarComponent],
  template: `
    <div class="pick" role="menu">
      <div class="mv-label">Give it to</div>
      @for (p of people(); track p.id) {
        <button type="button" role="menuitem" (click)="picked.emit(p.id)">
          <mv-avatar [person]="p" [size]="26" />
          <span class="name">{{ p.name }}</span>
          <span class="load">{{ load(p) }} open</span>
        </button>
      }
    </div>
  `,
  styles: [`
    :host { position: absolute; z-index: 30; top: calc(100% + 6px); left: 0; }
    .pick { background: var(--bg); border: 1px solid var(--surface2); border-radius: 18px; box-shadow: var(--shadow-md); padding: 10px; width: 240px; max-height: 300px; overflow: auto; }
    .mv-label { padding: 4px 8px 6px; }
    button { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: none; padding: 6px 8px; border-radius: 12px; cursor: pointer; text-align: left; font-size: 14px; }
    button:hover { background: var(--surface); }
    .name { flex: 1; font-weight: 700; }
    .load { font-size: 12px; color: var(--muted); }
  `],
} )
export class PersonPickerComponent {
  private readonly store = inject( FlowStore );
  private readonly host = inject( ElementRef );
  readonly people = input.required<Person[]>();
  readonly picked = output<string>();
  readonly closed = output<void>();

  load ( p: Person ): number {
    return loadOf( this.store.state(), p.id ).length;
  }

  @HostListener( 'document:click', ['$event'] )
  onDoc ( e: MouseEvent ): void {
    if ( !this.host.nativeElement.parentElement?.contains( e.target as Node ) ) this.closed.emit();
  }

  @HostListener( 'document:keydown.escape' )
  onEsc (): void {
    this.closed.emit();
  }
}

/** Inverted pill at bottom center with the TODD mark and an optional Undo. Auto-dismisses after 5s. */
@Component( {
  selector: 'mv-toast',
  standalone: true,
  template: `
    @if (toast(); as t) {
      <div class="tst" role="status" aria-live="polite" data-cy="flow-toast">
        <img [src]="icon" alt="" class="mv-plate">
        <span>{{ t.msg }}</span>
        @if (t.undo) { <button type="button" (click)="undo()" data-cy="toast-undo">Undo</button> }
      </div>
    }
  `,
  styles: [`
    .tst {
      position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 1000;
      display: flex; align-items: center; gap: 12px; max-width: calc(100vw - 32px);
      background: var(--text); color: var(--bg); border-radius: 999px; padding: 10px 20px 10px 10px;
      box-shadow: var(--shadow); font-size: 14px; font-weight: 500;
    }
    img { width: 28px; height: 28px; border-radius: 50%; background: #fff; }
    button { border: 0; background: none; color: var(--blue); font-weight: 700; cursor: pointer; padding: 0 0 0 4px; text-decoration: underline; text-underline-offset: 3px; }
    @media (max-width: 720px) { .tst { bottom: 84px; } }
  `],
} )
export class ToastComponent {
  private readonly store = inject( FlowStore );
  readonly toast = computed( () => this.store.toast() );
  readonly icon = TODD_ICON;

  undo (): void {
    const t = this.store.toast();
    this.store.dismissToast();
    t?.undo?.();
  }
}
