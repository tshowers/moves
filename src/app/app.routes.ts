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
    title: 'Moves for iPhone | Taliferro Tech',
    loadComponent: () =>
      import( './features/app-showcase/app-showcase.component' ).then( ( m ) => m.AppShowcaseComponent ),
  },
  {
    // The shared About page (taliferro-ui product-pages; copy in
    // product-pages.model.ts under 'moves').
    path: 'about',
    data: { page: 'about' },
    loadComponent: () =>
      import( './shared/product-pages/product-pages.component' ).then( ( m ) => m.ProductPagesComponent ),
  },
  {
    path: 'help',
    title: 'Moves Help: how to use Moves | Taliferro Tech',
    loadComponent: () =>
      import( './features/help/help.component' ).then( ( m ) => m.HelpComponent ),
  },
  {
    // Flow map (team edition) - design_handoff_moves_flow_map. Every
    // project as a line of moves against today; TODD finds the breaks and
    // fixes what its rules allow. Signed out (or ?demo=1) shows the sample
    // team; signed in shows the tenant's own moves.
    path: 'app',
    loadComponent: () =>
      import( './flow/shell/flow-root.component' ).then( ( m ) => m.FlowRootComponent ),
    loadChildren: () =>
      import( './flow/flow.routes' ).then( ( m ) => m.FLOW_ROUTES ),
  },
  // The old task-list screens, folded into the flow map.
  { path: 'moves', redirectTo: 'app', pathMatch: 'full' },
  { path: 'moves-view', redirectTo: 'app', pathMatch: 'full' },
  { path: 'tasks', redirectTo: 'app', pathMatch: 'full' },
  { path: 'move', redirectTo: 'app/new', pathMatch: 'full' },
  { path: 'move/:id', redirectTo: ( { params } ) => `/app?move=${encodeURIComponent( params['id'] )}` },
  { path: 'move/:id/mission', redirectTo: ( { params } ) => `/app?move=${encodeURIComponent( params['id'] )}` },
  { path: 'ai-missions', redirectTo: 'app/todd', pathMatch: 'full' },
  { path: 'plan', redirectTo: 'app/new', pathMatch: 'full' },
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
