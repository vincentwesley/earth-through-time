# Handover

## Status (2026-10-27)
Milestone 1 (MVP) is built and verified locally: typecheck, lint, 11 unit tests, 10 Playwright e2e tests (desktop + 375px, axe clean in dark and light), build, and a CSP check (the app runs under the production `_headers` CSP with no violations). Pushed to branch `claude/eloquent-wright-4gpyps`. **No PR yet** (see step 1).

## Your one-time steps
1. **Turn GitHub Actions off** for this repo: Settings > Actions > General > "Disable actions". The cloud session couldn't do it (the proxy blocks the Actions API with a 403). Until it's off, opening a PR or merging to `main` would start the `CI` workflow.
2. Then a session can open the PR from `claude/eloquent-wright-4gpyps` and merge it with `gh api -X PUT repos/vincentwesley/earth-through-time/pulls/<n>/merge -f merge_method=squash` (or merge it yourself in the UI).
3. **Cloudflare Pages:** Workers & Pages > Create > Pages > Connect to Git > pick `earth-through-time`. Production branch `main`, build command `npm run build`, output directory `dist`. Set environment variable `NODE_VERSION=24`. No secrets needed.
4. Optional: once you have the `*.pages.dev` URL, add it to the repo's About box and to the README.

## Notes
- `.github/workflows/ci.yml` calls the reusable workflow in the **private** `vincentwesley/house` repo from this **public** repo, which GitHub doesn't allow, so it would fail even with Actions on. It's left as is (Actions off). Starters PR #6 is meant to fix this.
- `.github/dependabot.yml` from the template was removed (it scheduled version updates for the deleted starter folders, and Dependabot version updates are off-limits).
- Cloud sessions have Node 22 (repo targets 24); all checks pass on 22. Run e2e with `PW_CHROMIUM=/opt/pw-browsers/chromium npm run test:e2e` there.
- `vincentwesley/gfx-kit` and `asset-vault` weren't in this session's GitHub scope, so the shaders (ocean fresnel, glow) are small and written inline. Nothing depends on a private repo.

## Known issues
- In the dark theme, today's terrane outlines (from the model's coastline polygons) draw internal block boundaries too. That's real model detail, but it's busy at today's scale. Could fade outlines by zoom.
- Fixed-step slerp between 1 Myr samples (error well under the model's own uncertainty).
- No offline/PWA support.
