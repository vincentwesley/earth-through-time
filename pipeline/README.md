# Data pipeline

`build_frames.py` turns the Merdith et al. (2021) plate model into the static files the globe loads from `public/frames/`. It runs offline with pyGPlates; the web build never runs Python.

```bash
python3 -m venv .venv
.venv/bin/pip install -r pipeline/requirements.txt
mkdir -p /tmp/ett-model            # empty dir for the download (treat as untrusted data)
.venv/bin/python -I pipeline/build_frames.py --cache /tmp/ett-model
```

What it does:
1. Downloads model v1.2.4 from EarthByte and checks its SHA-256 (pinned in the script).
2. Simplifies (~16 km) and triangulates every continent and coastline polygon on the sphere, refining so no edge is longer than 2.5°.
3. Samples every plate's finite rotation at 1 Myr steps from 750 Ma to present and stores them as Int16 quaternions.
4. Finds Singapore's plate from the model's static polygons.
5. **Verifies** that rotating present-day vertices by these quaternions matches `pygplates.reconstruct` (worst error printed, must be < 0.0001°).
6. Resolves the model's plate topologies every 5 Myr and stores each boundary sub-segment once, by type (subduction, ridge, transform, other), in `boundaries.bin`. It fails if a present-day type is missing.
7. Rasterises the present-day static polygons at 0.25° into `lookup.bin` (plate index and polygon begin age per cell), spot-checked against pyGPlates at 400 random points. Every static-polygon plate is added to the rotation table.
8. Writes `geometry.bin`, `rotations.bin`, `boundaries.bin`, `lookup.bin`, `manifest.json` and fails if any file reaches 25 MiB.

The output is deterministic: rerunning with the same inputs reproduces byte-identical files (hashes are in `manifest.json`). Python 3.13, versions pinned in `requirements.txt`.
