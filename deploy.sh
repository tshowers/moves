#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

trap 'echo "Deploy aborted - a previous step failed, nothing was deployed." >&2' ERR

echo "Running Moves production hosting deploy"
echo "Firebase project context: taliferrotech"
firebase use taliferrotech

echo "Building the production Moves bundle..."
npm run build

echo "Running unit tests..."
npm run test:ci

echo "Running end-to-end tests (Cypress)..."
npm run e2e

if [ -n "$(git status --porcelain)" ]; then
  echo "Build and tests passed - committing changes before deploy..."
  VERSION="$(node -p "require('./package.json').version")"
  git add -A
  git commit -m "Deploy: v${VERSION}"
else
  echo "No changes to commit - working tree already clean."
fi

echo "Deploying Moves to Firebase Hosting site todd-moves..."
firebase deploy --project taliferrotech --only hosting:todd-moves

echo "Moves hosting deploy complete."
firebase projects:list
