import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { MovesAuthService } from './moves-auth.service';

/**
 * Signed-in visitors who open the site at / land in /app. Navigating to /
 * from inside the site (the 16Ahead lockup in the /app rail or the site
 * header) shows the home page instead.
 */
export const landingRedirectGuard: CanActivateFn = () => {
  const authService = inject( MovesAuthService );
  const router = inject( Router );
  if ( router.getCurrentNavigation()?.previousNavigation ) return true;

  return authService.isLoggedIn().pipe(
    take( 1 ),
    map( isLoggedIn => isLoggedIn ? router.createUrlTree( ['/app'] ) : true ),
  );
};
