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

- 2026-11-17: `src/data/model.ts` and `timescale.ts` (never committed, lost) were reconstructed. The old `dist/` bundle did not contain them. Binary layout and the `Manifest` type come from `pipeline/build_frames.py`; maths from the pipeline (`qrot`, `unit`), the shader and `tests/`; period bases from the ICS chart v2024/12 PDF; colours from the ICS standard (Triassic, Jurassic and Tonian match the pixels in `docs/screenshots`); MOMENTS ages and labels from `docs/screenshots` (letter case inferred); `latitudeBand` Subtropics/Mid-latitudes at 35° and the "Polar regions" label are assumptions. 2026-11-22: checked against the original files (still in the MVP session's container). Logic, values, ICS ages and colours, MOMENTS and the 35° cut all match the originals; only names and comments differ, and the original said "Polar circle". The cause was the old `data/` ignore rule also matching `src/data/`.

## Milestone 2: plate boundaries (2026-11-22)
- `pipeline/build_frames.py` resolves topologies every 5 Myr into `public/frames/boundaries.bin` (3.6 MB). `geometry.bin` and `rotations.bin` regenerate byte-identical.
- A "Plate boundaries" toggle in the time panel with a 4-type legend, saved as `?b=1`. Verified: typecheck, lint, 17 unit tests, 40 e2e tests (`--timeout=150000`), build, and the production-CSP check.

## Milestone 3: pins anywhere (2026-11-22)
- `lookup.bin` (0.25° static-polygon grid, 229 KB) plus rotations for every static-polygon plate. A place picker (25 cities), tap at Today to drop a pin, a generic pin card and note, and `?place=` / `?pin=`.
- Boundary segments are now sorted in the pipeline: pyGPlates returned them in a different order between runs, and output is byte-identical again.
- Verified: typecheck, lint, 23 unit tests, 46 e2e tests, build, and the production-CSP check.

## Known issues
- In the dark theme, today's terrane outlines (from the model's coastline polygons) draw internal block boundaries too. That's real model detail, but it's busy at today's scale. Could fade outlines by zoom.
- Fixed-step slerp between 1 Myr samples (error well under the model's own uncertainty).
- No offline/PWA support.
