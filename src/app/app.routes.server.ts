import { RenderMode, ServerRoute } from '@angular/ssr';

// Public pages are built ahead of time as static HTML for search engines
// (taliferro-ui/PRODUCT-STANDARD.md, part 4). MovesAuthService treats "no
// browser" as signed out, so '' renders as the landing page rather than
// redirecting to /app. The app itself (/app/...) always renders in the browser.
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'help', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'pricing', renderMode: RenderMode.Prerender },
  { path: 'ios', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
