import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal(this.readInitialTheme());

  constructor() { this.apply(this.isDark()); }

  toggle(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    this.apply(next);
    if (typeof localStorage !== 'undefined') localStorage.setItem('moves-theme', next ? 'dark' : 'light');
  }

  private readInitialTheme(): boolean {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('moves-theme');
      if (saved === 'dark' || saved === 'light') return saved === 'dark';
    }
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private apply(dark: boolean): void {
    if (typeof document !== 'undefined') document.documentElement.dataset['theme'] = dark ? 'dark' : 'light';
  }
}
