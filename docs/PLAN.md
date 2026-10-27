# Plan

## Architecture
```
pipeline/build_frames.py  (Python + pyGPlates, offline)
  Merdith 2021 model zip ──► public/frames/{manifest.json, geometry.bin, rotations.bin}
                                       │ fetch (same origin)
src/main.ts ── UI: slider, play, jump chips, Singapore panel, theme, ?ma=
  ├─ src/data/model.ts      decode binaries, quaternion slerp, lat/lon maths
  ├─ src/data/timescale.ts  ICS periods, jump points, formatting
  └─ src/globe/globe.ts     three.js (lazy): ocean + glow, land via per-plate GPU rotation
                            (DataTexture of quaternions), outlines, latitude guides, pin + track
```

## MVP (milestone 1): done
A globe you can scrub from 750 Ma to today with reconstructed continents and a Singapore pin, polished, responsive, tested, deploy-ready.

## Next milestones
2. **Plate boundaries:** resolve topologies per 5 Myr in the pipeline (ridges, subduction zones, transforms) as an optional layer.
3. **More pins:** a pick-a-place search over a small bundled city list, plus tap anywhere on today's globe to drop a pin (reverse-reconstruct a clicked point via the static polygons shipped as plate lookup).
4. **Palaeolatitude chart** for the pin (sparkline of latitude vs time under the slider).
5. **Model comparison:** add Cao et al. 2024 as a second dataset if its licence is confirmed.
6. **Milestone QA:** `visual-check` (Lighthouse, axe, screenshots) and `ship-batch`.
