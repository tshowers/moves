# Testing

Before this, Moves had zero automated tests and `ng test` didn't even run (empty spec glob). Two suites now exist.

## Unit tests (Karma/Jasmine) — verified passing

```
npm test           # interactive, watches for changes (needs a display)
npm run test:ci    # headless, single run — use this in CI or a sandboxed shell
```

Currently covers `MovesAutomationService` (`src/app/services/moves-automation.service.spec.ts`, 24 specs) — the schedule/status/resource/suggestion logic behind the TODD Automation Cockpit on `/moves-view`. Pure logic, no `TestBed`, no DOM, no HTTP — the highest-value, lowest-cost target to start from. Component-level specs (`task-dashboard`, `task-view-parent`, etc.) are natural next additions but need `TestBed` + mocked `HttpClient`/`MovesAuthService`, a bigger lift than one session covered.

## E2E (Cypress) — ported, not runnable in every environment

```
npm run e2e         # starts the dev server, runs the full suite headlessly
npm run e2e:open    # starts the dev server, opens the interactive Cypress runner
npm run cy:run      # runs against a server you've already started yourself
npm run cy:open     # same, interactive
```

Eleven spec files in `cypress/e2e/`. Seven are ported from the TODD monorepo's own Moves suite (`cypress/e2e/moves*.cy.ts` there) and adapted to this app's actual routes (`/moves/app` → `/app`, `/moves/pricing` → `/pricing`, `/moves/success` → `/success`, etc. — checked against this app's real `app.routes.ts`, not assumed); `moves-views.cy.ts`, `mission-workspace.cy.ts`, `ai-missions.cy.ts`, and `moves-subtasks.cy.ts` are new, written directly against this app (no TODD equivalent existed to port for any of them).

| File | Covers |
|---|---|
| `moves.cy.ts` | Smoke: public shells, cockpit list rendering, search filter |
| `moves-auth.cy.ts` | Guest flows: browsing unauthenticated, guest save-draft warning, disabled Save for guests |
| `moves-crud.cy.ts` | Create/update/delete a move, save-failure toasts, checklist complete/uncomplete |
| `moves-routes.cy.ts` | Route shells, opening a move from the cockpit, the success-page fallback state |
| `moves-free.cy.ts` | Free-plan pricing gate and the real 2-move quota save wall |
| `moves-paid.cy.ts` | Checkout start + confirm flow |
| `moves-automation.cy.ts` | TODD Automation Cockpit: review queue, approve, history |
| `moves-views.cy.ts` | Create a move, verify its status/progress in the moves-view command panel, cycle through all 4 views (checklist/timeline/calendar/hierarchy), complete it from the hierarchy view (a code path the checklist-toggle tests above don't exercise), verify the command panel reflects completion |
| `mission-workspace.cy.ts` | `/plan`: guest demo-mode preview → approve → communication composer; required-field validation; signed-in real plan generation → approve → shows in recent missions; reopening an existing mission and reviewing/applying a plan revision |
| `ai-missions.cy.ts` | `/ai-missions` + `/move/:id/mission`: list rendering, approval banner → status filter, empty state, "+ New AI Mission" routing into the move form's AI-mission mode, opening a mission's detail/plan/activity log, running an active mission through to needs_approval, approving a pending mission action |
| `moves-subtasks.cy.ts` | Adding a subtask from an existing move (with `parentTaskId` asserted in the POST body), it appearing in the parent's subtask list, reopening it from there, and confirming the Subtasks panel is hidden both while creating a brand-new move and while editing a subtask itself |

Every `data-cy` selector, toast/heading text, and localStorage key referenced in these specs was checked against this app's actual source before porting (not assumed from the TODD original) — see the individual spec files' inline comments for the divergences found, including two real behavioral bugs the ORIGINAL TODD-ported tests would have hit if run as first written:
- Delete navigates to `/moves` here, not `/app`; toasts render as `.toast-header`, not `<h4>`.
- **`task-view-parent.component.ts` defaults `activeTab` to `'overview'`, not `'browser'` or `'selected'`.** The filter input, move list, view switcher, and empty state all live inside the Move Browser tab; the command panel (`moves-selected-open`) lives inside the Selected Move tab. Neither is the default. This affected `moves.cy.ts` (3 tests), `moves-auth.cy.ts` (1 test), `moves-crud.cy.ts` (2 checklist tests), and `moves-routes.cy.ts` (1 test) — all fixed with an explicit tab click (`moves-tab-browser` or `moves-tab-selected`) before the gated element is asserted on. Caught by tracing the component's actual tab-state logic, not by running the suite (see below).

`mission-workspace.component.html` had no `data-cy` attributes at all when it was built earlier this session (unlike every other ported page, which follows that convention) — added `moves-plan-title`, `moves-plan-problem-statement`, `moves-plan-desired-outcome`, `moves-plan-resources`, `moves-plan-generate`, and `moves-plan-approve` so `mission-workspace.cy.ts` had stable selectors to target rather than relying on button text alone.

`ai-mission-list`/`ai-mission-card`/`ai-mission-detail` also have no `data-cy` attributes, but their CSS classes (`.mission-card`, `.btn-view`, `.btn-run`, `.approval-panel`, `.filter-tab`, etc.) are specific enough that `ai-missions.cy.ts` uses those directly rather than adding new attributes - no ambiguity risk since each class only appears once per relevant scope in these two pages.

**Attachments were scoped out — deliberately, not skipped.** Investigating the "subtasks and attachments" ask surfaced that there's nothing real to test:
- There is no file-upload UI at all. `task-edit.component.ts` declares `storage`/`uploadProgress`/`selectedFile` fields, but per the component's own doc comment they're never wired to an `<input type="file">` in the template — that capability lives only in a different, separately-ported component (`task.component.ts`).
- The "Link existing document" dropdown (`moves-edit-existing-document`) is a documented pre-existing no-op: selecting a value is never pushed into the save payload, in the original TODD source as much as here. A test against it would just be pinning a known bug, not verifying a feature.
- Both that dropdown and the Related Contacts multi-select source their options from Firestore directly (`moves-data.service.ts`'s `getDocuments()`/`getContacts()` call the Firebase client SDK, not the REST API), not from `${backendURL}/...`. Every existing spec that touches this page stubs Firestore to a flat 403 so the load fails fast instead of hanging - which also means those dropdowns are always empty under the current mocking approach. Testing a real contact/document selection would need the Firebase Emulator Suite wired into the harness, a meaningfully bigger lift than `cy.intercept()`.

Progress in this app is **not** independently editable through any form field — `task-edit.component.ts` has no progress input at all. The only way progress changes is completing/reopening a move (checklist toggle or hierarchy's Complete/Reopen button, both wired to the same `handleComplete()`), which jumps it straight to 100% or back. `moves-views.cy.ts`'s "update progress" step is that completion action, not a manual progress edit — there's currently no UI to test the latter because it doesn't exist.

**Auth**: `visitWithCypressAuth()` (in `cypress/support/commands.ts`) signs a test in without driving the real hosted-login redirect, via a `getCypressAuthOverride()` escape hatch added to `MovesAuthService`. It only activates when `window.Cypress` is present — never in production or normal dev use. Ported from the identical pattern already used across the rest of the TODD product suite.

**Why "ported, not runnable in every environment"**: this suite could not be executed in the sandbox this port was written in — Cypress's Electron-based binary fails its own startup smoke-test there regardless of flags (`--no-sandbox`, headless, etc.), while plain headless Chrome (which Karma uses) launches fine. That looks like a sandbox-specific restriction on this particular binary, not a problem with the suite itself — every selector, string, and route was hand-verified against this app's real source rather than assumed. Run `npm run e2e` locally (or in CI, where Cypress typically runs without issue) to get a real pass/fail signal; report back anything that fails and it'll get fixed.
