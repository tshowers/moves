import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { tap } from 'rxjs/operators';
import { WriteAccessService } from '../../services/write-access.service';
import { MovesSignupDraftService } from '../../services/moves-signup-draft.service';

/**
 * "Browse free, create with the app" (Ty, 2026-09-28): shown to signed-in
 * visitors who don't have the Moves app yet - they can look at everything,
 * and this says why Save is off and where to get the app. Mentions the
 * Move they planned in /get-started, which saves on their next sign-in
 * once they have the app. Hidden when signed out (the browse-mode banner
 * covers that) and for anyone who can write.
 */
@Component( {
  selector: 'app-get-the-app-banner',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './get-the-app-banner.component.html',
  styleUrl: './get-the-app-banner.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class GetTheAppBannerComponent {
  private readonly drafts = inject( MovesSignupDraftService );
  readonly pendingTitle = this.drafts.pendingTitle();
  readonly state$ = inject( WriteAccessService ).state( 'moves' ).pipe(
    // Signed in before buying the app: the planned Move saves the first
    // time a page with this banner sees they can write.
    tap( ( state ) => {
      if ( state === 'canWrite' && this.pendingTitle ) void this.drafts.submitIfPending();
    } ),
  );
}
