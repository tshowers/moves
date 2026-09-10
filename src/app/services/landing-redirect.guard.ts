import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { MovesAuthService } from './moves-auth.service';

export const landingRedirectGuard: CanActivateFn = () => {
  const authService = inject( MovesAuthService );
  const router = inject( Router );

  return authService.isLoggedIn().pipe(
    take( 1 ),
    map( isLoggedIn => isLoggedIn ? router.createUrlTree( ['/app'] ) : true ),
  );
};
