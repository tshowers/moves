import { Component, input } from '@angular/core';

/** The 16Ahead dials (taliferro-ui/brand/products) this app shows. */
const MARK_FILES = { '16ahead': '01-16ahead', 'marketing-assistant': '03-marketing-assistant', moves: '06-moves' };
export type MarkName = keyof typeof MARK_FILES;

/**
 * A 16Ahead dial as its light/dark pair; the theme hides one (styles.css
 * .brand-mark--*). inverse: on a surface in the opposite theme (the toast).
 * Size it from the parent with a class on <mv-mark>.
 */
@Component( {
  selector: 'mv-mark',
  standalone: true,
  template: `<img class="brand-mark--light" [src]="src(inverse() ? 'dark' : 'light')" [alt]="alt()"><img class="brand-mark--dark" [src]="src(inverse() ? 'light' : 'dark')" alt="">`,
  styles: [':host { display: inline-flex; flex: none; width: 30px; height: 30px; } img { width: 100%; height: 100%; object-fit: contain; }'],
} )
export class BrandMarkComponent {
  readonly name = input.required<MarkName>();
  readonly alt = input( '' );
  readonly inverse = input( false );

  src ( set: 'light' | 'dark' ): string {
    return `assets/brand/products/svg/${set}/${MARK_FILES[this.name()]}.svg`;
  }
}

/** The 16Ahead lockup: the Moves dial, "16Ahead", then "Moves" in muted text. */
@Component( {
  selector: 'mv-lockup',
  standalone: true,
  imports: [BrandMarkComponent],
  template: `<mv-mark name="moves" class="dial" /><span class="name">16Ahead <span class="brand-product">Moves</span></span>`,
  styles: [`
    :host { display: inline-flex; align-items: center; gap: 10px; color: var(--text); }
    .dial { width: 32px; height: 32px; }
    .name { font-weight: 700; letter-spacing: -0.02em; font-size: 20px; white-space: nowrap; }
    @media (max-width: 420px) { :host { gap: 8px; } .dial { width: 26px; height: 26px; } .name { font-size: 17px; } }
  `],
} )
export class LockupComponent {}
