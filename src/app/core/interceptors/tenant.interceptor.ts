import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MovesAuthService } from '../../services/moves-auth.service';

/**
 * Line-for-line port of the monorepo's core/interceptors/tenant.interceptor.ts,
 * pointed at MovesAuthService instead of TODD's AuthService. Every backend
 * call this app makes (TaskApiService, AiMissionApiService, GoalApiService,
 * MovesEmailService, MovesDropdownEditButtonComponent...) was ported
 * verbatim from code that relied on this interceptor supplying tenant/user
 * headers automatically - see MovesAuthService's getTenant()/
 * getCurrentUserIdSync()/getCurrentUserEmailSync() for how those are kept
 * available synchronously.
 */
function isBackendApiRequest ( url: string ): boolean {
  return url.includes( '/api/' );
}

export const tenantInterceptor: HttpInterceptorFn = ( req, next ) => {
  if ( !isBackendApiRequest( req.url ) ) {
    return next( req );
  }

  const authService = inject( MovesAuthService );
  const tenantId = authService.getTenant();
  const userId = authService.getCurrentUserIdSync();
  const userEmail = authService.getCurrentUserEmailSync();

  if ( !tenantId || !userId ) {
    return next( req );
  }

  const cloned = req.clone( {
    setHeaders: {
      'X-Tenant-Id': tenantId,
      'X-User-Id': userId ?? '',
      'X-User-Email': userEmail ?? ''
    }
  } );

  return next( cloned );
};
