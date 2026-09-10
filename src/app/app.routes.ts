import { Routes } from '@angular/router';
import { landingRedirectGuard } from './services/landing-redirect.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [landingRedirectGuard],
    loadComponent: () =>
      import( './features/landing/landing.component' ).then( ( m ) => m.LandingComponent ),
  },
  {
    path: 'ios',
    loadComponent: () =>
      import( './features/app-showcase/app-showcase.component' ).then( ( m ) => m.AppShowcaseComponent ),
  },
  {
    // The real signed-in app experience - task-home.component.ts ported
    // from TODD, confirmed as the actual live moves/moves-app route there.
    path: 'app',
    loadComponent: () =>
      import( './features/task-home/task-home.component' ).then( ( m ) => m.TaskHomeComponent ),
  },
  {
    // Legacy alias - the monorepo's 'moves' route also resolves to
    // TaskHomeComponent, kept here so old links still land somewhere real.
    path: 'moves',
    loadComponent: () =>
      import( './features/task-home/task-home.component' ).then( ( m ) => m.TaskHomeComponent ),
  },
  {
    path: 'moves-view',
    loadComponent: () =>
      import( './features/task-view-parent/task-view-parent.component' ).then( ( m ) => m.TaskViewParentComponent ),
  },
  {
    // Legacy 'tasks' route redirects to the execution board in the
    // monorepo too - kept as a redirect rather than a duplicate route.
    path: 'tasks',
    redirectTo: 'moves-view',
  },
  {
    path: 'move',
    loadComponent: () =>
      import( './features/task-edit/task-edit.component' ).then( ( m ) => m.TaskEditComponent ),
  },
  {
    path: 'move/:id',
    loadComponent: () =>
      import( './features/task-edit/task-edit.component' ).then( ( m ) => m.TaskEditComponent ),
  },
  {
    path: 'ai-missions',
    loadComponent: () =>
      import( './features/ai-mission-list/ai-mission-list.component' ).then( ( m ) => m.AiMissionListComponent ),
  },
  {
    path: 'move/:id/mission',
    loadComponent: () =>
      import( './features/ai-mission-detail/ai-mission-detail.component' ).then( ( m ) => m.AiMissionDetailComponent ),
  },
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
    // Keep authorization failures inside the standalone Moves app. These
    // aliases cover both spellings used by the shared TODD shell.
    path: 'not-authorized',
    redirectTo: 'app',
    pathMatch: 'full',
  },
  {
    path: 'unauthorized',
    redirectTo: 'app',
    pathMatch: 'full',
  },
  {
    // Catches any unmatched URL - without this the router just silently
    // fails to navigate instead of showing anything.
    path: '**',
    loadComponent: () =>
      import( './features/not-found/not-found.component' ).then( ( m ) => m.NotFoundComponent ),
  },
];
