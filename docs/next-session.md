> Update at the end of any session that changed state. Keep it lean.

# Earth Through Time: next session

## Before anything
1. Read this file, `docs/HANDOVER.md` (owner steps, Actions status) and `docs/PLAN.md`.
2. `npm ci --ignore-scripts`, then the checks below.

## How to work here
- Checks: `npm run typecheck && npm run lint && npm test && npm run build && PW_CHROMIUM=/opt/pw-browsers/chromium npm run test:e2e`
- Data: `pipeline/README.md`. Never hand-edit `public/frames/`.
- One branch and one PR per milestone; self-merge via `gh api` (see CLAUDE.md).

## Current state
- Milestone 1 (MVP) merged to `main`.

- Branch `vin-atelier-brand` (unpushed): draggable Vin's Atelier logo + studio credits in the credits sign-off (`src/brand/`, `e2e/logo.spec.ts`).

## Known gaps
1. Owner: connect Cloudflare Pages (HANDOVER.md).
2. Next milestone: plate boundaries layer (PLAN.md #2).
- CI: .github/workflows/ci.yml is now inlined (house reusable workflow is private); no dependabot.yml exists, stale PRs #1-3 target nonexistent dirs (2026-11-17).
- 2026-11-17 hygiene sweep: qa-output/ gitignored, dependabot added.
- 2026-11-17: logo spec waits for the --logo-x transition before measuring (15s polls).
- 2026-11-18: re-copied kit tokens.css per UPGRADING.md (credits.css still older kit; needs markup change). e2e needs --timeout=150000 under load: software-GL axe/logo specs exceed 30s.
