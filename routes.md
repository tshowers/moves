# Moves — Routes

From [`src/app/app.routes.ts`](src/app/app.routes.ts) and [`src/app/flow/flow.routes.ts`](src/app/flow/flow.routes.ts). Base URL `https://moves.taliferro.tech`.

## Public (prerendered for search engines)

| Route | Component | Notes |
|---|---|---|
| `/` | `LandingComponent` | Signed-in visitors are sent to `/app` (`landingRedirectGuard`). |
| `/help` | `HelpComponent` | How to use Moves, plus the Getting Started checklist when signed in. |
| `/about` | `ProductPagesComponent` (shared) | Copy in `taliferro-ui/platform/product-pages.model.ts` (`moves`). |
| `/pricing` | `GetTheAppComponent` | Browse free, subscribe to create (web via Stripe, or the iPhone app). |
| `/ios` | `AppShowcaseComponent` | Moves for iPhone. |

## The app — flow map (`/app`, rendered in the browser)

All of these show the sample team when signed out, or with `?demo=1`. Add `?move=<id>` to any of them to open that move in the drawer.

| Route | Screen |
|---|---|
| `/app` | Momentum — every project as a line against today, TODD's notes in the margin. |
| `/app/projects/:id` | Project — Flow tab, with Diagnosis. |
| `/app/projects/:id/:tab` | `sequence`, `moves`, `people` or `log`. |
| `/app/team` | Team — each person's load across projects. |
| `/app/todd` | TODD — what needs you, the log (with Undo), rules, and on / practising / paused. |
| `/app/review` | Weekly review — one decision at a time, keys 1–4. Full screen. `?item=<issue id>` opens that item. |
| `/app/new` | New project — paste a plan; TODD checks it. Full screen. |
| `/app/digest` | Morning digest (phone layout). |
| `/app/me` | My next moves (phone layout, a team member's view). `?as=<person id>` previews someone else on the sample team. |

## Account

| Route | Notes |
|---|---|
| `/get-started` | Pre-sign-in wizard: plan a first move, give your name, sign in. Afterwards opens `/app/new` with that move as the start of the plan. |
| `/login` | Straight to TODD's hosted sign-in. Accepts `?returnUrl=`. |
| `/auth/callback` | Hosted sign-in returns here; not navigable by hand. |
| `/profile` | Profile (shared fields with the iOS apps). |
| `/mobile-handoff` | Sign-in handoff from the iOS apps. |

## Redirects (old links)

| From | To |
|---|---|
| `/moves`, `/moves-view`, `/tasks` | `/app` |
| `/move` | `/app/new` |
| `/move/:id`, `/move/:id/mission` | `/app?move=:id` |
| `/ai-missions` | `/app/todd` |
| `/plan` | `/app/new` |
| `/success` | `/app` |
| `/not-authorized`, `/unauthorized` | `/app` |
| anything else | `NotFoundComponent` |
