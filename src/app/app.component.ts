import { AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { environment } from '../environments/environment';
import { MovesAuthService } from './services/moves-auth.service';
import { ToastComponent } from './shared/toast/toast.component';
import { CommandPaletteComponent } from './shared/page/command-palette/command-palette.component';
import { SiteFooterComponent } from './shared/site-footer/site-footer.component';
import { PlatformMenuComponent } from './shared/platform-menu/platform-menu.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, CommandPaletteComponent, SiteFooterComponent, PlatformMenuComponent, AsyncPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  private readonly router = inject( Router );
  private readonly authService = inject( MovesAuthService );
  readonly isAdmin$ = this.authService.getUser().pipe( map( user => user?.uid === environment.taliferroTenantId ) );
  readonly isLanding = signal( this.router.url === '/' || this.router.url === '' );

  constructor () {
    this.router.events.pipe( filter( event => event instanceof NavigationEnd ) ).subscribe( event => {
      this.isLanding.set( ( event as NavigationEnd ).urlAfterRedirects === '/' );
    } );
  }

  title = 'moves';
}
