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
    path: 'help',
    loadComponent: () =>
      import( './features/help/help.component' ).then( ( m ) => m.HelpComponent ),
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
    // Mission Workspace - TODD's Goal Engine mission planner (intake ->
    // AI plan preview -> approve -> real Moves). Routed at /plan rather
    // than TODD's own /mission, which collides with the unrelated
    // autonomous-agent concept at move/:id/mission above - see
    // mission-workspace-migration-plan.md. No auth guard, matching
    // ai-missions' current posture; supports ?demo=1 for unauthenticated
    // preview.
    path: 'plan',
    loadComponent: () =>
      import( './features/mission-workspace/mission-workspace.component' ).then( ( m ) => m.MissionWorkspaceComponent ),
  },
  {
    // Pre-sign-in wizard: plan a first Move, give your name, then sign in
    // (ONBOARDING-PROFILE-BILLING-PLAYBOOK.md). /login stays the direct
    // handoff for returning users and deep links.
    path: 'get-started',
    loadComponent: () =>
      import( './features/get-started/get-started.component' ).then( ( m ) => m.GetStartedComponent ),
  },
  {
    // In-app profile (shared fields/API with the iOS apps' TODDProfileKit),
    // replacing the menu's link out to TODD's /update-profile.
    path: 'profile',
    loadComponent: () =>
      import( './features/profile/profile.component' ).then( ( m ) => m.ProfileComponent ),
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
    path: 'mobile-handoff',
    loadComponent: () =>
      import( './features/mobile-handoff/mobile-handoff.component' ).then( ( m ) => m.MobileHandoffComponent ),
  },
  {
    // The old Stripe checkout return page - Moves is sold through the App
    // Store now (Ty, 2026-09-28), so old links land on the app.
    path: 'success',
    redirectTo: 'app',
  },
  {
    // "Browse free, create with the app" (Ty, 2026-09-28) - shared wording
    // in @taliferro/ui/platform/get-the-app.model.ts; replaces the old
    // Stripe plan page.
    path: 'pricing',
    data: { product: 'moves' },
    loadComponent: () =>
      import( './features/get-the-app/get-the-app.component' ).then( ( m ) => m.GetTheAppComponent ),
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
