# Moves — Testable Routes

Generated from [`src/app/app.routes.ts`](src/app/app.routes.ts).

| Route                                           | Component                   | Notes                                                                                                                         |
| ----------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `https://moves.taliferro.tech/`                 | `LandingComponent`          | Guarded by `landingRedirectGuard` — if already signed in, redirects to `/app`; otherwise shows the marketing landing page.    |
| `https://moves.taliferro.tech/ios`              | `AppShowcaseComponent`      | App showcase / iOS marketing page.                                                                                            |
| `https://moves.taliferro.tech/app`              | `TaskHomeComponent`         | Main signed-in app experience.                                                                                                |
| `https://moves.taliferro.tech/moves`            | `TaskHomeComponent`         | Legacy alias for `/app` (same component).                                                                                     |
| `https://moves.taliferro.tech/moves-view`       | `TaskViewParentComponent`   | Execution/task board view.                                                                                                    |
| `https://moves.taliferro.tech/tasks`            | —                           | Redirects to `/moves-view`.                                                                                                   |
| `https://moves.taliferro.tech/move`             | `TaskEditComponent`         | Create a new move/task (no id).                                                                                               |
| `https://moves.taliferro.tech/move/:id`         | `TaskEditComponent`         | Edit an existing move/task — needs a real `:id`.                                                                              |
| `https://moves.taliferro.tech/ai-missions`      | `AiMissionListComponent`    | List of AI missions.                                                                                                          |
| `https://moves.taliferro.tech/move/:id/mission` | `AiMissionDetailComponent`  | AI mission detail for a given move — needs a real `:id`.                                                                      |
| `https://moves.taliferro.tech/login`            | `SignInComponent`           | Currently **always** starts a new hosted-login redirect, even if already signed in (see fix #3 below). Accepts `?returnUrl=`. |
| `/auth/callback`                                | `AuthCallbackComponent`     | Hosted-login redirect target; expects `state`/token query params, not directly navigable.                                     |
| `https://moves.taliferro.tech/success`          | `MovesPaidSuccessComponent` | Post-payment success page.                                                                                                    |
| `https://moves.taliferro.tech/pricing`          | `MovesPricingComponent`     | Pricing page.                                                                                                                 |
| `/not-found`                                    | `NotFoundComponent`         | 404 page.                                                                                                                     |
| `/not-authorized`                               | —                           | Redirects to `/app`.                                                                                                          |
| `/unauthorized`                                 | —                           | Redirects to `/app`.                                                                                                          |
| `*` (anything else)                             | `NotFoundComponent`         | Catch-all 404.                                                                                                                |

## Suggested test pass

- [ ] `/` while signed out → landing page shown
- [ ] `/` while signed in → auto-redirects to `/app` (guard works)
- [ ] `/login` while signed out → hosted-login redirect works, lands back on `returnUrl` or `/app`
- [ ] `/login` while signed in → **currently redirects out to hosted login anyway** (bug — see fix #3)
- [ ] `/app`, `/moves` → same screen
- [ ] `/moves-view`, `/tasks` (redirect check)
- [ ] `/move` → new move form
- [ ] `/move/:id` with a real id → edit form loads existing data
- [ ] `/move/:id/mission` with a real id
- [ ] `/ai-missions`
- [ ] `/pricing`, `/success`
- [ ] `/ios`
- [ ] `/not-authorized`, `/unauthorized` → land on `/app`
- [ ] Random unmatched path → 404 page
- [ ] Global menu: Sign In label/behavior signed-out vs signed-in (currently static — see fix #4)
