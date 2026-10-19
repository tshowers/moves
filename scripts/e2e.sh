#!/usr/bin/env bash
# Runs this app's Cypress suite against a dev server on a free port.
# Port 4200 is often taken by another app's dev server, so the first free
# port from 4200 up is used (or E2E_PORT if set). ELECTRON_RUN_AS_NODE is
# cleared because VS Code's terminal sets it and Cypress then fails to start.
#   npm run e2e                 # whole suite
#   npm run e2e -- --spec cypress/e2e/missions.cy.ts
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${E2E_PORT:-}"
if [ -z "$PORT" ]; then
  for candidate in $(seq 4200 4299); do
    if ! lsof -nP -iTCP:"$candidate" -sTCP:LISTEN >/dev/null 2>&1; then PORT="$candidate"; break; fi
  done
fi
[ -n "$PORT" ] || { echo "No free port between 4200 and 4299." >&2; exit 1; }

LOG="$(mktemp -t e2e-serve.XXXXXX)"
echo "Serving on port $PORT for Cypress (log: $LOG)"
npx ng serve --port "$PORT" >"$LOG" 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT

for _ in $(seq 1 120); do
  if grep -q "Local:" "$LOG"; then break; fi
  if ! kill -0 "$SERVER" 2>/dev/null; then echo "The dev server stopped:" >&2; tail -20 "$LOG" >&2; exit 1; fi
  sleep 2
done
grep -q "Local:" "$LOG" || { echo "The dev server didn't start in time." >&2; tail -20 "$LOG" >&2; exit 1; }

env -u ELECTRON_RUN_AS_NODE npx cypress run --config "baseUrl=http://localhost:$PORT" "$@"
