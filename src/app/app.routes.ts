import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import( './features/sign-in/sign-in.component' ).then( ( m ) => m.SignInComponent ),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import( './features/auth-callback/auth-callback.component' ).then( ( m ) => m.AuthCallbackComponent ),
  },
  {
    path: 'success',
    loadComponent: () =>
      import( './features/moves-paid-success/moves-paid-success.component' ).then( ( m ) => m.MovesPaidSuccessComponent ),
  },
  {
    path: 'pricing',
    loadComponent: () =>
      import( './features/moves-pricing/moves-pricing.component' ).then( ( m ) => m.MovesPricingComponent ),
  },
  {
    path: 'not-found',
    loadComponent: () =>
      import( './features/not-found/not-found.component' ).then( ( m ) => m.NotFoundComponent ),
  },
  {
    // Catches any unmatched URL - without this the router just silently
    // fails to navigate instead of showing anything.
    path: '**',
    loadComponent: () =>
      import( './features/not-found/not-found.component' ).then( ( m ) => m.NotFoundComponent ),
  },
];
