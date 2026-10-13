# Testing

## Unit tests (Karma + Jasmine)

```
npm run test:ci    # headless, single run (CI, deploy.sh)
npm test           # watches
```

| Spec | Covers |
|---|---|
| `src/app/flow/flow-engine.spec.ts` | The flow engine against the **shared fixture** `src/app/flow/testing/flow-team.fixture.json`: "most room", stalls, the 48h lane rule, order breaks, and "waiting isn't stuck". |
| `src/app/flow/flow-assistant-context.spec.ts` | What TODD's assistant is told about each screen and the open move. |
| `src/app/services/moves-auth.service.spec.ts` | Hosted sign-in state and return URL. |

The fixture is a copy of `todd-backend/functions/__tests__/fixtures/flow-team.json`. The backend tests its TODD rules against the same team (`moves.flowRules.test.js`), so the app's engine and the server's rules can't quietly disagree. If you change one copy, change the other.

## End-to-end (Cypress)

```
npm run e2e        # starts the dev server and runs every spec headlessly
npm run cy:open    # interactive runner, against a server you started yourself
```

From a VS Code terminal, prefix Cypress with `env -u ELECTRON_RUN_AS_NODE` (VS Code sets it, which breaks Cypress's launcher).

| Spec | Covers |
|---|---|
| `moves.cy.ts` | **Sample team:** lines and margin notes, assigning a gap and Undo, applying a proposed order, the weekly review from the keyboard, the move drawer, New project checks, old links redirecting, and the assistant knowing the screen and move. **Signed in (stubbed API):** loading moves and TODD's state from the server, the write-access prompt, a decision logged on the server and undone, an Undo conflict, rule switches, the practice week and turning TODD on, "Can't do it", "TODD told X by push", the sign-up handoff to New project, and the one-time localStorage import. |
| `landing.cy.ts` | One Menu button (also after jumping to `#signal`), ⌘K search, Powered by TODD / Also from us, the footer. |
| `help.cy.ts` | Help's section order and its start-a-project links. |
| `get-started.cy.ts` | The sign-up wizard. |
| `moves-free.cy.ts` | `/pricing` and the old `/success` link. |

Signed-in specs use `cy.visitWithCypressAuth(path, user)` (`cypress/support/commands.ts`). It only works under Cypress (`window.Cypress`). They stub the API with `cy.intercept` and answer Firestore with 403, so no real data is touched.

## Backend

The server side of the flow map is tested in `taliferrotech/todd-backend/functions` with Jest: `npx jest __tests__/moves __tests__/push`.
