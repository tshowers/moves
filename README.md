# Moves

![Moves banner](public/assets/moves-banner.png)

Moves is an assistant for the person who keeps a team moving (a project lead with 8–25 people). Every project is drawn as a **line of moves against today**. A move with no owner, no next action, no recent activity, or set before the work it waits on shows up as a break in the line. **TODD** (the admin assistant) fixes the small breaks within rules the lead sets and logs every change with Undo. **Maya** (the content assistant) does emails, posts and images. Whatever TODD can't fix inside its rules goes to the lead.

Live at **https://moves.taliferro.tech**. The design source is `corporate/design_handoff_moves_flow_map` (the "flow map", team edition).

---

## 1. Get running

### Prerequisites

| | |
|---|---|
| Node | **22** (developed on 22.13). The backend's Cloud Functions also run on Node 22. |
| npm | Comes with Node. |
| Sibling checkout of **taliferro-ui** | `package.json` depends on `"@taliferro/ui": "file:../../taliferro-ui"`, and `tsconfig.app.json` compiles `../../taliferro-ui/platform/**`. The folders must sit side by side like this: |

```
corporate/
├── taliferro-ui/            # shared menu, footer, tokens, Help/About template, write-access kit
├── taliferrotech/           # repo holding todd-backend (the API Moves calls)
├── apps/ios/moves-ios/      # the iPhone app (same API, same account)
└── web-products/moves/      # this repo
```

Optional: Chrome (headless unit tests and Cypress), the Firebase CLI (deploys), and Xcode with XcodeGen (iOS).

### Install and start

```bash
npm install
npm start            # ng serve -> http://localhost:4200
```

You don't need a login to look around: signed out, `/app` shows a **sample team** (`src/app/flow/flow-demo.data.ts`). Add `?demo=1` to any `/app` URL to force the sample team while signed in. Signing in uses the real hosted TODD login, so local runs read and write **production data** for your account. There is no local backend or emulator setup.

### Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server. Public pages are server-rendered in dev too (see §6). |
| `npm run build` | Production build into `dist/moves`, including the prerendered public pages. **The `prebuild` step bumps the version** in `package.json` and `public/assets/version.json` (see §3). Use `npx ng build` when you don't want that. |
| `npm run test:ci` | Unit tests (Karma + Jasmine, headless Chrome). `npm test` watches. |
| `npm run e2e` | Starts the dev server and runs every Cypress spec headlessly. `npm run cy:open` gives the interactive runner against a server you started yourself. |
| `npm run typecheck:cypress` | Type-checks the Cypress specs. |
| `npm run deploy:hosting` | `deploy.sh`: build, unit tests, e2e, commit, then deploy to Firebase Hosting (see §8). |

> **Cypress from a VS Code terminal:** VS Code sets `ELECTRON_RUN_AS_NODE=1`, which makes Cypress fail with `Cannot find module …/Cypress.app/…/index.js`. Run `env -u ELECTRON_RUN_AS_NODE npx cypress run …`.

---

## 2. Configuration

There is no `.env`. Everything is in `src/environments/environment.ts` (dev) and `environment.prod.ts` (prod, which differs only in `production: true`):

| Key | Used for |
|---|---|
| `backendURL` | Base for every API call: `https://api.taliferro.tech/api` (todd-backend's `api` Cloud Function). |
| `firebaseConfig` | Firebase project **taliferrotech**: Auth (signed-in user, ID tokens) and direct Firestore reads (§5). |
| `taliferroTenantId` | The master tenant. Its owner is treated as admin in the menu and always has write access. |
| `PLATFORM_URL` | Canonical site URL. |
| `VERSION` | Read from `package.json`; compared with `/assets/version.json` to detect a new deploy. |

Firebase web config values are public by design; access is enforced by Firebase Auth, Firestore rules and the API.

---

## 3. How the app works

### Auth and tenancy
- **Sign-in** is TODD's hosted login. `MovesAuthService.signIn(returnUrl)` sends the browser to todd.taliferro.tech, which comes back to `/auth/callback` with a custom token; Firebase then signs in with it. `/get-started` is the pre-sign-in wizard; `/login` goes straight to sign-in.
- **Every API call** gets the Firebase ID token and the tenant id from two interceptors: `core/interceptors/id-token.interceptor.ts` and `tenant.interceptor.ts`.
- **Write access** follows "browse free, create with the app". Anyone can look at everything; creating and editing needs the Moves subscription, either App Store or web via Stripe. The app reads `writeAccess.moves` from `GET /account/summary` (`WriteAccessService`) and shows the shared sign-in/subscribe prompt before any write. The server enforces the same rule and answers `403 APP_PURCHASE_REQUIRED`.
- **Tests sign in** with `cy.visitWithCypressAuth(path, user)` (`cypress/support/commands.ts`), which writes `__cypressAuthOverride` to localStorage. `MovesAuthService` only honours it when `window.Cypress` exists.

### The flow map: `src/app/flow/`
Everything under `/app` lives here. It is standalone components and signals, with no NgModules.

| File / folder | Role |
|---|---|
| `flow.models.ts` | Person, FlowProject, FlowMove, ToddAction (with before/after for Undo), ToddRule, Issue, track types. |
| `flow-engine.ts` | **Pure functions**: issues (gap, stall, order, pile-up, capacity), "most room", node kinds, tracks, forecast, critical path, sequence proposals, margin notes. Every screen reads from it. |
| `flow.store.ts` | One signals store. **Demo mode** (signed out or `?demo=1`) keeps the sample team in memory. **Live mode** maps the tenant's moves, projects and members, and sends every decision to the server as a logged action. It also handles optimistic updates, rollback on error, the toast, and the one-time import of anything an older version kept in localStorage. |
| `flow-api.service.ts` | `/api/moves/flow/*`, plus `cant-do`. |
| `flow-assistant-context.ts` | Builds the page context TODD's chat sees (screen, data, open move), published from `shell/flow-root.component.ts`. |
| `flow-demo.data.ts` | The sample team from the design (14 people, 5 projects), dated relative to today. |
| `shell/` | `FlowRootComponent` (theme scope, toast, move drawer from `?move=<id>`, assistant context) and `FlowShellComponent` (224px rail on desktop, tab bar on phones). |
| `screens/` | Momentum, Project (Flow/Sequence/Moves/People/Log + Diagnosis), Team, TODD, Review (keys 1–4), New project (paste a plan), My next moves (phone), Digest (phone), Move drawer. |
| `ui/` | `mv-flow-track` (the line, built once), avatars, person picker, toast, issue card, log rows. |
| `flow-theme.css` | The Find theme tokens for the app (`.mv` scope), with light and dark. |
| `testing/flow-team.fixture.json` | A small team shared with the backend's tests (§7). |

Routes are in `src/app/app.routes.ts` (top level) and `src/app/flow/flow.routes.ts` (under `/app`). `routes.md` lists them all.

### Public pages
`/` landing (`features/landing`), `/help` (`features/help`), `/about` (the shared Help/About template, `shared/product-pages`), `/pricing` (`features/get-the-app`), `/ios` (`features/app-showcase`), `/get-started`, `/login`, `/profile`. These use the universal menu (with ⌘K search), the site footer and "Also from us", all from taliferro-ui.

The landing page's quote section shows the **TODD demo video** (`handoff_landing_video`). It plays from `src/assets/video/moves-todd-demo-light.mp4` and `moves-todd-demo-dark.mp4`, exported from Claude Design's `TODD Demo.dc.html` (Share → Export → Video, with the "Dark theme" tweak off and on). The clips are 1080×1920, about 20 s, silent and looping; the one shown matches the site theme. Until those files exist, the video frame hides itself.

### TODD's assistant
`shared/page/assistant-box/` is the floating "Talk to TODD" chat on every page. On `/app` pages it gets the screen's context from `flow-assistant-context.ts`, and the guidance card at the top is built from the same data. Its shortcuts are in `services/moves-assistant-capabilities.service.ts`; chat goes to `POST /app-assistant`.

### Updates
The prebuild script writes the new version to `public/assets/version.json`. The running app checks it every 60s (and listens for service-worker updates), then reloads. It waits while someone is in New project or has a move open.

---

## 4. Shared code you must not edit here

These files are **copied in from `../../taliferro-ui`** by its `sync.sh` scripts and carry a `SYNCED FROM` header. Edit the template in taliferro-ui, then run its sync:

| In this repo | Source in taliferro-ui | This app's own settings |
|---|---|---|
| `shared/platform-menu/platform-menu.component.*` | `menu-component/` | `platform-menu.config.ts` |
| `shared/site-footer/site-footer.component.*` | `site-footer-component/` | — |
| `shared/also-from-us/also-from-us.component.ts` | `also-from-us-component/` | — |
| `shared/product-pages/product-pages.component.*` | `product-pages-component/` | `product-pages.config.ts`; copy in `platform/product-pages.model.ts` (`moves`) |
| `shared/write-access/*` | `write-access/` | `write-access.config.ts` |
| `services/sound.service.ts` | `sound/` | — |

Other taliferro-ui pieces are imported directly: `styles/tokens.css`, `controls.css`, `universal-menu.css`, `site-footer.css` and `product-pages.css` (all in `src/styles.css`), plus `platform/*.model.ts` (products, ⌘K search index, pricing copy). **When you add a page, add it to `platform/search-index.model.ts`** so ⌘K can find it. The rules for all of this are in `taliferro-ui/PRODUCT-STANDARD.md`.

---

## 5. APIs and data

All HTTP goes to `environment.backendURL` (todd-backend, repo `taliferrotech/todd-backend/functions`).

| Endpoint | Caller | Purpose |
|---|---|---|
| `GET/POST /moves`, `GET/PUT/DELETE /moves/:id` | `TaskApiService` | Moves (stored in Firestore `tenants/{t}/tasks`). Fields include `nextAction`, `dependsOn`, `executionLane` (todd / maya / person), `dateLockedBy`, `laneNotes`. The server sets `lastActivityAt` and `laneEnteredAt`. |
| `POST /moves/:id/notes` | `TaskApiService` | A note on a move. |
| `POST /moves/:id/done`, `POST /moves/:id/cant-do` | `FlowApiService`, moves-ios | The assignee's own actions. "Can't do it" sends the move back to TODD to route again. |
| `GET /moves/flow` | `FlowApiService` | TODD's log, rules, dismissed issues, capacity, project details, and autonomy (on / practising / off). The first call registers the workspace and starts TODD's 7-day practice week. |
| `POST /moves/flow/actions`, `POST /moves/flow/actions/:id/undo` | `FlowApiService` | A decision applied and logged on the server. Undo restores the "before" state, or returns `409 UNDO_CONFLICT` if the move changed since. |
| `PUT /moves/flow/rules/:id`, `POST`/`DELETE /moves/flow/dismissed…`, `PUT /moves/flow/people/:id/capacity`, `PUT /moves/flow/projects/:id`, `PUT /moves/flow/autonomy`, `POST /moves/flow/import` | `FlowApiService` | Settings, and the one-time localStorage import. |
| `GET /account/summary` | `AccountBillingService`, `WriteAccessService` | Write access per product. |
| `/billing/*` | `WebCheckoutService` (shared) | Stripe web checkout and portal. |
| `POST /onboarding/profile`, `/profile` | `MovesSignupDraftService`, `ProfileApiService` | Profile (name from the sign-up wizard). |
| `GET /getting-started/moves` | `GettingStartedService` | The Getting Started checklist on Help. |
| `POST /app-assistant` | `OpenAIService` | TODD's chat. |
| `POST /mobile/moves/...`, `/mobile/push/devices` | moves-ios only | Same moves plus push registration, with verified-token auth. |

**Firestore, read directly** (`MovesDataService`, `MovesAdminService`):
- `tenants/{t}/projects`: project names. Details such as ship date, lead and phases are written through `PUT /moves/flow/projects/:id`.
- `users` where `companyId == t`: team members.
- `tenants/{t}/contacts/{t}`: the workspace owner.

**Server side, nothing the web app runs:** `scheduledFlowTodd` (every 30 min) applies TODD's rules (`moves/flowRules.js`) and sends push or email (`flowNotify.js`). `scheduledFlowDigest` (hourly) emails each project lead a digest at 6am in their own time zone. Push goes to the Moves iOS app (`push.service.js`, app `moves`).

---

## 6. Static pages for SEO

`/`, `/help`, `/about`, `/pricing` and `/ios` are **prerendered at build time** into `dist/moves/browser/<route>/index.html` with real content, titles and canonical URLs. Everything else renders in the browser.

- **Config:** `angular.json` (`server`, `prerender`, `ssr`), `src/main.server.ts`, `src/server.ts`, `src/app/app.config.server.ts`, `src/app/app.routes.server.ts`.
- **No browser at build time:** anything that touches `window`, `document`, `localStorage`, `sessionStorage` or `navigator` while a public page or the app shell starts must be guarded. Use `typeof window === 'undefined'`; see `AppComponent.ngOnInit`, `MovesAuthService.isServer` and the assistant launcher. The auth service reports "signed out" at build time, so `/` prerenders as the landing page.
- **Hosting:** `index.html` *is* the landing page, so unknown URLs fall back to `/index.csr.html` (`firebase.json` rewrite and `ngsw-config.json` `index`).
- **Check after a build:** `dist/moves/browser/help/index.html` etc. contain the page text, not just `<app-root>`.

---

## 7. Testing

- **Unit (`src/**/*.spec.ts`):** the flow engine against the shared fixture (`flow-engine.spec.ts`), the assistant page context, and auth.
- **E2E (`cypress/e2e/`):**
  - `moves.cy.ts`: the flow map, both the sample team and signed in with stubbed APIs (decisions, Undo, conflicts, rules, practice week, can't-do, sign-up handoff, the assistant).
  - `landing.cy.ts`: one Menu button, ⌘K, the footer.
  - `help.cy.ts`, `get-started.cy.ts`, `moves-free.cy.ts`: the other public pages.
- **Shared fixture:** `src/app/flow/testing/flow-team.fixture.json` is a copy of `todd-backend/functions/__tests__/fixtures/flow-team.json`. The app's engine and the server's TODD rules are both tested against it, so they agree on stalls, the 48h lane rule, order breaks and "most room". **If you change one copy, change the other.**

`TESTING.md` has more detail.

---

## 8. Deploying

`npm run deploy:hosting` runs `deploy.sh`:
1. Builds (bumping the version).
2. Runs the unit and Cypress tests.
3. Commits the working tree as `Deploy: v<version>`.
4. Deploys to Firebase Hosting site `todd-moves` in project `taliferrotech`.

The API ships separately from the `taliferrotech` repo. **Deploy the backend first** whenever the web app needs a new endpoint.

---

## 9. Related repos

| Repo | What it is |
|---|---|
| `taliferrotech/todd-backend/functions` | The API: `moves/` (moves.service, flow.service, flowRules, flowAutonomy, flowMember, flowNotify, flowDigest), `push/`, and the scheduled jobs. |
| `apps/ios/moves-ios` | The iPhone app (SwiftUI, XcodeGen `project.yml`). Push registration, plus Done and Can't do it on notifications. |
| `taliferro-ui` | Shared menu, footer, tokens, Help/About template, write-access kit, and the product standard. |
