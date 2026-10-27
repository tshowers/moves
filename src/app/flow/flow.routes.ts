import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { map, take } from 'rxjs';

import { MovesAuthService } from '../services/moves-auth.service';

/**
 * Maya's "Review N tasks" button lands on /app/maya?from=maya. Someone who
 * is signed out there came for their own tasks, not the sample team, so
 * send them to sign in and back.
 */
const signInFromMaya: CanActivateFn = ( route ) => {
  if ( route.queryParamMap.get( 'from' ) !== 'maya' ) return true;
  const router = inject( Router );
  return inject( MovesAuthService ).isLoggedIn().pipe(
    take( 1 ),
    map( signedIn => signedIn || router.createUrlTree( ['/login'], { queryParams: { returnUrl: '/app/maya' } } ) ),
  );
};

/** Everything under /app. FlowRootComponent hosts the drawer (?move=) and toast for all of them. */
export const FLOW_ROUTES: Routes = [
  // Full-screen: no rail.
  { path: 'review', loadComponent: () => import( './screens/review.component' ).then( ( m ) => m.ReviewComponent ) },
  { path: 'new', loadComponent: () => import( './screens/new-project.component' ).then( ( m ) => m.NewProjectComponent ) },
  { path: 'me', loadComponent: () => import( './screens/my-moves.component' ).then( ( m ) => m.MyMovesComponent ) },
  {
    // Rail on desktop, tab bar on phones.
    path: '',
    loadComponent: () => import( './shell/flow-shell.component' ).then( ( m ) => m.FlowShellComponent ),
    children: [
      { path: '', loadComponent: () => import( './screens/momentum.component' ).then( ( m ) => m.MomentumComponent ) },
      { path: 'maya', canActivate: [signInFromMaya], loadComponent: () => import( './screens/maya-queue.component' ).then( ( m ) => m.MayaQueueComponent ) },
      { path: 'team', loadComponent: () => import( './screens/team.component' ).then( ( m ) => m.TeamComponent ) },
      { path: 'todd', loadComponent: () => import( './screens/todd.component' ).then( ( m ) => m.ToddComponent ) },
      { path: 'digest', loadComponent: () => import( './screens/digest.component' ).then( ( m ) => m.DigestComponent ) },
      { path: 'projects/:id', loadComponent: () => import( './screens/project.component' ).then( ( m ) => m.ProjectComponent ) },
      { path: 'projects/:id/:tab', loadComponent: () => import( './screens/project.component' ).then( ( m ) => m.ProjectComponent ) },
      { path: '**', redirectTo: '' },
    ],
  },
];
