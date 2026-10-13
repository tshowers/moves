import { Routes } from '@angular/router';

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
      { path: 'team', loadComponent: () => import( './screens/team.component' ).then( ( m ) => m.TeamComponent ) },
      { path: 'todd', loadComponent: () => import( './screens/todd.component' ).then( ( m ) => m.ToddComponent ) },
      { path: 'digest', loadComponent: () => import( './screens/digest.component' ).then( ( m ) => m.DigestComponent ) },
      { path: 'projects/:id', loadComponent: () => import( './screens/project.component' ).then( ( m ) => m.ProjectComponent ) },
      { path: 'projects/:id/:tab', loadComponent: () => import( './screens/project.component' ).then( ( m ) => m.ProjectComponent ) },
      { path: '**', redirectTo: '' },
    ],
  },
];
