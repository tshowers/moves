# Mission Workspace → Moves: Migration Plan

Source: `/Users/tyshowers/Dropbox/corporate/taliferrotech/frontend/src/app/features/help/mission-workspace`
(`mission-workspace.component.ts` 1549 lines, `.html` 549 lines, `.css` 709 lines)

## Key clarification before scoping

**Mission Workspace and Moves' existing `AiMissionDetailComponent` are two different "mission" concepts that will coexist, not merge:**

| | Mission Workspace (to port) | `ai-mission-detail` (already in Moves) |
|---|---|---|
| Backend surface | `${backendURL}/missions/*` (TODD's Goal Engine) | `${backendURL}/ai-missions/*` (autonomous agent execution) |
| What it does | Plan → preview → approve → creates real Moves | Runs an agent step-by-step (`run`/`approve`/`pause`/`complete`) against an already-created mission |
| Data model | `ToddMissionRecord` (intake, plan, health, drift, risks, communications) | `AIMission` (status, `MissionStep[]`, activity log, artifacts) |

Nothing here replaces `ai-missions` / `move/:id/mission`. Routed at `/plan` — not `/mission` (TODD's own path, and too close to the existing `/move/:id/mission`).

## Decisions (settled)

1. **Route name** — `/plan`.
2. **Demo mode** — port it (unauthenticated client-side simulated preview).
3. **Writing-identity auto-fill** — skip for v1.
4. **Onboarding "first win" tracking** — port for real (not stubbed).
5. **Auth guard** — none; `/plan` stays open like `/ai-missions` currently is.

## Phase 1 — Service layer (small, foundational) — ✅ done

Extended `goal-api.service.ts` with all 7 missing methods (`previewToddMissionPlan`, `createToddMission`, `updateToddMission`, `previewToddMissionRevision`, `applyToddMissionRevision`, `updateToddMissionStatus`, `listToddMissions`), matching TODD's `goal.service.ts` payload/URL shapes exactly. Expanded `mission.model.ts` to the full `ToddMissionRecord` shape (intake, plan, moves, progress, health, drift, risks, revision(s), communicationDrafts/Notes) plus `ToddMissionIntake`, `ToddMissionMove`, `ToddMissionType`. Verified against the one existing consumer (`task-view-parent.component.ts`'s mission banner) and `tsc --noEmit` clean.

## Phase 1 (original notes, for reference)

Extend what Moves already has rather than duplicating it.

- **`src/app/services/goal-api.service.ts`** — currently only has `getToddMission(id)`. Add the 7 missing methods:
  - `previewToddMissionPlan` → `POST /missions/plan`
  - `createToddMission` → `POST /missions`
  - `applyToddMissionRevision` → `POST /missions/{id}/revisions/apply`
  - `previewToddMissionRevision` → `POST /missions/{id}/revision-preview`
  - `updateToddMission` → `PUT /missions/{id}`
  - `updateToddMissionStatus` → `POST /missions/{id}/status`
  - `listToddMissions` → `GET /missions`
- **`src/app/models/mission.model.ts`** — expand the trimmed `ToddMissionRecord` (currently just `id/status/title/moveCount/progress` + index signature) to the full shape used by the component: intake, plan, moves, drift, risks, communicationDrafts, health, revision. Add `ToddMissionIntake`, `ToddMissionMove`, `ToddMissionType`.

No new backend calls needed — Moves already talks to `environment.backendURL`, same host.

## Phase 2 — Shared UI dependency — ✅ done

Ported `SectionJumpComponent` wholesale to `src/app/shared/section-jump/` (matching Moves' flattened `shared/` convention, e.g. `back-to-top`, `preloader`). Self-contained, only depends on `@angular/common`. Also extended its dark-mode CSS to respond to Moves' manual `[data-theme]` toggle (`ThemeService`), not just OS `prefers-color-scheme`, matching the pattern already used in `platform-menu`/`app-showcase`.

Everything else the component needs is already in Moves and can be used as-is:
`PreloaderComponent`, `BackToTopComponent`, `TaskService`→Moves' `task-api.service.ts`, `Task`→`task.model.ts`, `NotificationService`→`moves-notification.service.ts`, `AuthService`→`moves-auth.service.ts`, `LoggerService`, `ClickSoundDirective`, and `ToddAssistantBusService`→Moves' `MovesAssistantSignalService` (already a working no-op stand-in with matching method names).

## Phase 3 — Supporting services — ✅ done

- **`ToddWritingIdentityService`** — skipped per decision #3. The 3 auto-fill fields (company description/audience/value-prop) stay blank in the intake form for v1.
- **Onboarding "first win" tracking** — ported as `src/app/services/moves-onboarding.service.ts` (`MovesOnboardingService`). TODD's `todd-onboarding.service.ts` is 515 lines covering a cross-product "which TODD product should I try first" overlay system, with route-suppression lists for every other TODD product (outreach, docs, pulse, lead-vault...) - none of that exists in Moves and none of it is called by mission-workspace. Scoped the port to exactly what mission-workspace calls: `completeFirstWin()`, implemented for real against the same localStorage-backed, per-user/tenant-keyed state shape TODD uses (not a no-op) - plus `hasCompletedFirstWin()` and `clearGuidedSession()`, which `completeFirstWin()` depends on internally.
- **`AssistantPageContext` type** — deferred to Phase 4; it's only meaningful once something constructs a context object to pass to `setPageContext()` (already accepts `Record<string, unknown>`), so it'll be defined inline in `mission-workspace.component.ts` rather than as a speculative standalone type with no consumer yet.

## Phase 4 — The component itself — ✅ done

Ported `mission-workspace.component.ts`/`.html`/`.css` to `src/app/features/mission-workspace/`, rewiring every import resolved in Phases 1–3 (`GoalApiService`, `MovesAuthService`, `MovesAssistantSignalService`, `TaskApiService`, `MovesNotificationService`, `MovesOnboardingService`, `SectionJumpComponent`, `PreloaderComponent`, `BackToTopComponent`, `ClickSoundDirective`). All 10 functional pieces from the original plan are in: intake form, plan preview, approve-and-create-Moves, recent-mission switcher, health/drift/risk dashboard, revision diffing with supersede-not-delete, communication draft composer, helper-card + focus mode, pending-preview localStorage persistence, and demo mode.

Adaptations beyond the mechanical import rewiring:
- `applyIdentityDefaults()` and all `identityState`/`ToddWritingIdentityService` wiring removed per decision #3.
- `/mission` route checks → `/plan` (in `bindEngagementActions()`'s URL guard and the demo-mode sign-in link's `returnUrl`).
- Copied `assets/moves/mission.png` (the intake hero illustration) into `src/assets/moves/` — didn't exist in Moves yet.
- Fixed two malformed `rgba()` calls in the source CSS (missing commas — `rgba(15, 15, 15 0.08)` isn't valid; browsers silently drop the declaration).
- **Fixed a real bug found via live testing, not present-but-dormant in TODD**: approving a mission in demo mode syncs `missionId=demo-active-1` into the URL, which re-triggered a real (unguarded) backend load for a demo-only id on the next `queryParamMap` emission → 401 → "Authentication required for this data." overwrote the working demo UI. Added a `!demoEnabled` guard. Verified via a live headless-browser pass (intake → generate plan → approve → full dashboard renders correctly, no console errors) before and after the fix — see the before/after screenshots from that session.
- `openCommunicationDraftInComposer()` still targets `/compose-email`, which doesn't exist in Moves — left as-is, same "degrade to the app's own not-found page" posture as `ai-mission-detail.component.ts`'s `artifactLink()`.

`tsc --noEmit` clean, production build succeeds (`mission-workspace-component` lazy chunk, ~104KB raw / ~20KB transfer).

## Phase 5 — Routing & discoverability — ✅ done

- `/plan` added to `app.routes.ts` (lazy-loaded, no guard, per decision #5).
- Added to `platform-menu.component.ts`'s route list ("Mission Workspace") and `command-palette-entries.ts` ("Mission Workspace" / `moves-plan`).
- **Not done**: contextual CTAs on `task-home.component.ts`/`task-view-parent.component.ts` for "this Move has no linked mission yet" (TODD shows these). That requires actual copy/placement/trigger-condition decisions inside two existing, already-working components rather than pure discoverability — held back as a follow-up rather than folded in here.
- TODD's proactive-assistant/engagement-engine routing into `/mission` doesn't apply — Moves doesn't have that system — skipped.

## Phase 6 — Tests

Given the [test-coverage finding](routes.md) (zero tests in Moves currently, `ng test` doesn't even run), don't expect to inherit any automated coverage for this from TODD either — grep found no Mission-Workspace-specific spec files in TODD's 46 `*.spec.ts` files. Recommend at minimum a manual test checklist (same style as `routes.md`) covering: intake → preview → approve → Moves created; reopening an existing mission → revision preview → apply; demo mode if ported. A real Cypress spec for this is a reasonable follow-up once/if the broader "port the Moves e2e suite" work happens.

## Status: Phases 1–5 done, live and routed at `/plan`

What's left: Phase 6 (tests — none exist, same as the rest of Moves), and the deferred task-home/task-view-parent CTA integration noted in Phase 5.
