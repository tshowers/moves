import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import packageJson from '../../../../package.json';
import { RouterModule } from '@angular/router';

import { getPlatformMenuItems, PlatformMenuItem } from '@taliferro/ui/platform/account-menu.model';

interface ProductLink {
  label: string;
  url: string;
  icon: string;
  description: string;
}

interface AppRouteLink { label: string; route: string; signOut?: boolean; }

/**
 * Top-right hamburger that slides a panel down over the page. Products on
 * the left (the other standalone apps), Account on the right (the TODD
 * routes that never got ported per-app - profile, billing, admin, etc.) -
 * see taliferrotech's TODD-routes-migration doc and the Maya app's version,
 * which this mirrors.
 */
@Component( {
  selector: 'app-platform-menu',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './platform-menu.component.html',
  styleUrl: './platform-menu.component.css',
} )
export class PlatformMenuComponent implements OnChanges {
  @Input() isAdmin = false;
  @Input() isLoggedIn = false;
  @Output() readonly signOut = new EventEmitter<void>();

  isOpen = false;
  readonly appVersion = String(packageJson.version || '').trim();

  appRoutes: AppRouteLink[] = [];
  accountItems: PlatformMenuItem[] = [];

  constructor () {
    this.recompute();
  }

  ngOnChanges (): void {
    this.recompute();
  }

  private recompute (): void {
    this.appRoutes = [
      { label: 'Home', route: '/' },
      { label: 'Moves Home', route: '/app' },
      { label: 'Execution', route: '/moves-view' },
      { label: 'New Move', route: '/move' },
      { label: 'Mission', route: '/plan' },
      { label: 'iOS App', route: '/ios' },
      { label: 'Help', route: '/help' },
      this.isLoggedIn
        ? { label: 'Sign Out', route: '/', signOut: true }
        // New visitors start in the wizard; it links returning users to /login.
        : { label: 'Sign In', route: '/get-started' },
    ];

    // Moves owns its own in-product help page. Hide the shared TODD-level
    // Help item so Moves users stay on moves.taliferro.tech/help.
    this.accountItems = getPlatformMenuItems().filter( ( item ) =>
      // Profile is in-app (/profile), linked on its own in the template.
      item.id !== 'platform-profile' && item.label !== 'Billing' && item.label !== 'Help' && ( !item.adminOnly || this.isAdmin )
    );
  }

  trackByLabel ( _index: number, item: { label: string } ): string {
    return item.label;
  }

  readonly productLinks: ProductLink[] = [
    { label: 'Ask TODD', url: 'https://ask.taliferro.tech', icon: 'assets/find/entities/todd/logo-bw-icon.png', description: 'Turn uncertainty into the next move.' },
    { label: 'Network', url: 'https://network.taliferro.tech', icon: 'assets/find/entities/network/logo-bw-icon.png', description: 'Know who matters before the moment passes.' },
    { label: 'Outreach', url: 'https://outreach.taliferro.tech', icon: 'assets/find/entities/outreach/logo-bw-icon.png', description: 'Keep the work moving.' },
    { label: 'Docs', url: 'https://docs.taliferro.tech', icon: 'assets/find/entities/docs/logo-bw-icon.png', description: 'Give your best thinking somewhere to live.' },
    { label: 'Pulse', url: 'https://pulse.taliferro.tech', icon: 'assets/find/entities/pulse/logo-bw-icon.png', description: 'Hear what people are really saying.' },
    { label: 'Social', url: 'https://social.taliferro.tech', icon: 'assets/find/entities/social/logo-bw-icon.png', description: 'Stay visible without living online.' },
    { label: 'Lead Vault', url: 'https://lead-vault.taliferro.tech', icon: 'assets/find/entities/lead-vault/logo-bw-icon.png', description: 'Find the people behind the opportunity.' },
    { label: 'Maya', url: 'https://maya.taliferro.tech', icon: 'assets/find/entities/maya/logo-bw.png', description: 'Think like your marketing director.' },
    { label: 'SayIt', url: 'https://sayit.taliferro.tech', icon: 'assets/find/entities/sayit/logo-bw-icon.png', description: 'Make your message worth sharing.' },
    { label: 'Find', url: 'https://find.taliferro.tech', icon: 'assets/find/entities/find/logo-bw-icon.png', description: 'Get to the answer faster.' },
    { label: 'Email Signature', url: 'https://signature.taliferro.tech', icon: 'assets/find/entities/email-signature-builder/logo-bw-icon.png', description: 'Make every email carry your brand.' },
    { label: 'Image Creator', url: 'https://images.taliferro.tech', icon: 'assets/find/entities/image-creator/logo-bw-icon.svg', description: 'Turn an idea into an image.' },
    { label: 'Email Creator', url: 'https://emails.taliferro.tech', icon: 'assets/find/entities/email-creator/logo-bw-icon.svg', description: 'Design an email that looks the part.' },
    { label: 'Music', url: 'https://music.taliferro.com', icon: 'assets/find/entities/music/logo-bw-icon.png', description: 'Let the soundtrack keep moving.' },
  ];

  toggle (): void {
    this.isOpen = !this.isOpen;
  }

  close (): void {
    this.isOpen = false;
  }

  handleRouteClick ( event: MouseEvent, link: AppRouteLink ): void {
    if ( !link.signOut ) return;
    event.preventDefault();
    this.close();
    this.signOut.emit();
  }
}
