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
2. **Plate boundaries: done (2026-11-22).** Topologies resolved every 5 Myr in the pipeline; toggleable layer with legend and `?b=1`.
3. **More pins: done (2026-11-22).** Place picker with 25 cities, tap at Today to drop a pin, 0.25° plate lookup from the static polygons, `?place=` / `?pin=`.
4. **Palaeolatitude chart** for the pin (sparkline of latitude vs time under the slider).
5. **Model comparison:** add Cao et al. 2024 as a second dataset if its licence is confirmed.
6. **Milestone QA:** `visual-check` (Lighthouse, axe, screenshots) and `ship-batch`.
