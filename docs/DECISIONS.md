# Decisions

1. **Starter: vite-ts.** A static web app; no extension or proxy needed.
2. **Model: Merdith et al. 2021 v1.2.4.** The only well-cited open full-plate model covering 750 Ma→0 in one consistent frame. Cao et al. 2024 is a future option.
3. **Ship rotations, not per-era meshes.** Instead of one mesh per era, ship present-day geometry once plus each plate's rotation every 1 Myr (Int16 quaternions). The GPU rotates every vertex by its plate's quaternion. For these plate-ID features this is exactly what `pygplates.reconstruct` does (the pipeline checks it: worst error 0.00001°). Result: ~5 MB total, smooth scrubbing to any year, and slerp between frames.
4. **Layers:** continental crust (`shapes_continents`) under today's land shapes (`coastlines_v2`) with their outlines. Plate boundaries are left for a later milestone (they need topology resolution each frame).
5. **Simplification ~16 km** and drop slivers below ~80 km²: invisible at globe scale, and it keeps geometry at 2.5 MB.
6. **Singapore** = 1.29°N 103.85°E, plate found from the model's static polygons (64701). Its track is drawn for the whole range. Before 410 Ma the UI says plainly that the model ties this crust to Australia.
7. **No runtime services.** Everything is same-origin; the CSP stays `'self'` only. GPlates Web Service was rejected (third-party, no SLA).
8. **three.js loaded lazily** (own chunk, ~135 kB gzip), so the page shell and controls appear at once.
9. **Licences:** code MIT; data CC BY 4.0 (Zenodo record), credited in the README, `THIRD_PARTY_NOTICES.md` and the page, with a non-affiliation note.
10. **Colours:** house dark/mint palette. Ocean teal, two greens for crust and land, peach pin and track, lavender latitude guides; ICS colours on the period chip.
11. **Shareable time** with `?ma=`.
12. **GitHub:** the template's `ci.yml` and `automerge.yml` are kept unchanged but unused (Actions must be off). `.github/dependabot.yml` was **removed**: it scheduled npm and Actions version updates for the old starter folders, and the owner's rule forbids Dependabot version updates (its PRs would also trigger CI).
13. **Pipeline outputs go in `public/frames/`**, not `data/`, because the house `.gitignore` ignores `data/`.
14. **Plate boundaries resolved every 5 Myr and snapped, not interpolated.** Boundaries change shape (ridges jump, plates appear), so there is no honest way to tween them; 5 Myr keeps `boundaries.bin` at 3.6 MB and resolving takes ~30 s. Lines are stored already in position, grouped by frame and type, so a time change is just a draw-range change. Types: SubductionZone, MidOceanRidge, Transform, and everything else (inferred palaeo-boundaries, faults, etc.) as "other".
15. **Pins use a 0.25° present-day plate lookup.** The static polygons are rasterised offline (1440×720 cells, run-length encoded, 229 KB). Polygon-precision tests in the browser would mean shipping and testing ~127k vertices. A 400-point spot check finds 1.5% of points differ, all at polygon edges (≤ ~28 km). Every static-polygon plate gets rotations, which adds ~230 KB.
16. **Tap only at Today.** A past position can't be mapped back to a single plate honestly (crust overlaps, gets created or destroyed), so dropping a pin at another time shows a hint instead.
17. **Pinned crust before its polygon exists:** the pin still follows its plate's rotation, and the card says the crust may not have existed yet. Oceanic polygons are often young (e.g. 5 Ma near the East Pacific Rise).
