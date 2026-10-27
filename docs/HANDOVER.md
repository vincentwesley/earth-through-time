# Handover

## Status (2026-10-27)
Milestone 1 (MVP) is built and verified locally: typecheck, lint, 11 unit tests, 10 Playwright e2e tests (desktop + 375px, axe clean in dark and light), build, and a CSP check (the app runs under the production `_headers` CSP with no violations). Merged to `main` via a squash PR from `claude/eloquent-wright-4gpyps`.

## Your one-time steps
1. **Cloudflare Pages:** Workers & Pages > Create > Pages > Connect to Git > pick `earth-through-time`. Production branch `main`, build command `npm run build`, output directory `dist`. Set environment variable `NODE_VERSION=24`. No secrets needed.
2. Optional: once you have the `*.pages.dev` URL, add it to the repo's About box and to the README.

## Notes
- GitHub Actions is still enabled for the repo (the owner chose not to disable it; the session can't, as the proxy blocks the Actions API). Nothing here relies on Actions. `CI` fails at startup (see below), and `automerge.yml` only acts after a successful CI run, so it never merges anything. Public repos don't use paid Actions minutes on standard runners anyway.
- `.github/workflows/ci.yml` calls the reusable workflow in the **private** `vincentwesley/house` repo from this **public** repo, which GitHub doesn't allow, so it would fail even with Actions on. It's left as is (Actions off). Starters PR #6 is meant to fix this.
- `.github/dependabot.yml` from the template was removed (it scheduled version updates for the deleted starter folders, and Dependabot version updates are off-limits).
- Cloud sessions have Node 22 (repo targets 24); all checks pass on 22. Run e2e with `PW_CHROMIUM=/opt/pw-browsers/chromium npm run test:e2e` there.
- `vincentwesley/gfx-kit` and `asset-vault` weren't in this session's GitHub scope, so the shaders (ocean fresnel, glow) are small and written inline. Nothing depends on a private repo.

## Known issues
- In the dark theme, today's terrane outlines (from the model's coastline polygons) draw internal block boundaries too. That's real model detail, but it's busy at today's scale. Could fade outlines by zoom.
- Fixed-step slerp between 1 Myr samples (error well under the model's own uncertainty).
- No offline/PWA support.
