> Update at the end of any session that changed state. Keep it lean.

# Earth Through Time: next session

## Before anything
1. Read this file, `docs/HANDOVER.md` (owner steps, Actions status) and `docs/PLAN.md`.
2. `npm ci --ignore-scripts`, then the checks below.
3. **Check that Actions is disabled before any PR or merge.** Branch pushes are fine (CI only triggers on PRs and `main`).

## How to work here
- Checks: `npm run typecheck && npm run lint && npm test && npm run build && PW_CHROMIUM=/opt/pw-browsers/chromium npm run test:e2e`
- Data: `pipeline/README.md`. Never hand-edit `public/frames/`.
- One branch and one PR per milestone; self-merge via `gh api` (see CLAUDE.md).

## Current state
- Milestone 1 (MVP) done on `claude/eloquent-wright-4gpyps`, pushed, no PR (Actions not yet confirmed off).

## Known gaps
1. Owner: disable Actions, connect Cloudflare Pages (HANDOVER.md).
2. Next milestone: plate boundaries layer (PLAN.md #2).
