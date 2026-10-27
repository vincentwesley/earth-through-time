# Research (2026-10-27)

## Plate models
| Model | Range | Licence | Fit for 750 Ma |
|---|---|---|---|
| **Merdith et al. 2021**, ESR 214, 103477 ([doi](https://doi.org/10.1016/j.earscirev.2020.103477), [files](https://www.earthbyte.org/webdav/ftp/Data_Collections/Merdith_etal_2021_ESR/), [Zenodo v1.2.4](https://zenodo.org/records/13635864)) | 1000 Ma–0 | CC BY 4.0 (Zenodo); EarthByte pages say CC BY 3.0 | **Chosen.** One continuous full-plate model across the whole range, palaeomagnetic frame. |
| Cao et al. 2024, Geoscience Frontiers 15(6) 101922 ([doi](https://doi.org/10.1016/j.gsf.2024.101922)) | 1800 Ma–0 | unverified (Zenodo) | Good alternative; future "compare models" option. |
| Zahirovic et al. 2022, Geoscience Data Journal ([doi](https://doi.org/10.1002/gdj3.146)) | Phanerozoic (range unverified) | unverified | Doesn't reach 750 Ma; possible detail layer later. |
| Müller et al. 2019, Tectonics 38 | ~240 Ma–0 | paper CC BY-NC-ND | Too short; avoid (NC-ND). |

Checked: the Merdith v1.2.4 zip (8.6 MB) ships its own continents, coastlines, static polygons and cratons, so no GSHHG or other separately licensed layer is needed. The model readme (SM2_ReadMe.txt) lists the papers to cite; they are in the README.

## Tools
- **pyGPlates 1.0.0**: on PyPI (`pip install pygplates`, Python 3.8–3.13); © University of Sydney. Licence not stated on the docs page (GPlates desktop is GPLv2), so it is only used offline and never shipped. [docs](https://www.gplates.org/docs/pygplates/)
- **plate-model-manager** 1.3.2 (GPLv2) and **gplately** (GPL-2.0): handy for fetching models and plotting. Not needed: a direct download with a pinned hash is simpler.
- **GPlates Web Service** (gws.gplates.org): pyGPlates over HTTP. Returned 503 during research. A third-party runtime host with no uptime or quota promise, and every scrub would be a network call, so it is avoided.
- **three.js** r184 (MIT). **earcut** (ISC; used via mapbox-earcut in the pipeline only).

## Similar projects
- **Ancient Earth** (Ian Webster, [dinosaurpictures.org/ancient-earth](https://dinosaurpictures.org/ancient-earth)) uses C.R. Scotese's PALEOMAP maps (750 Ma–now) on a globe, with address search and jump-to events. Reused as ideas: labelled jump points, keyboard stepping, "where was my place". Avoided: its imagery and text, and PALEOMAP (a different licence chain, and an artist's palaeogeography rather than a kinematic plate model).
- **GPlates desktop / GPlates Portal**: the reference tools; no open web globe with smooth scrubbing found.
- three-globe, LithoSphere: generic globes, no plate reconstructions.

**What makes this one stand out:** continuous scrubbing at any Ma (GPU per-plate rotation with quaternion slerp, not pre-rendered images); data verified against `pygplates.reconstruct`; the full 750 Myr track of one place's rocks; no runtime third-party calls.

## Singapore geology (for the pin text)
Singapore sits on the Sibumasu and Indochina–East Malaya blocks, joined along the Bentong–Raub Suture; both rifted off Gondwana in the Palaeozoic and collided in the latest Triassic to earliest Jurassic. Bukit Timah granites are ~285–230 Ma arc rocks (Gillespie et al. 2019, [NORA](https://nora.nerc.ac.uk/id/eprint/526168)). The UI only states what the model does (plate 64701 "East Malay Peninsula", fixed to Australia before 410 Ma) and avoids claims beyond it.

## Worth installing later
- `gplately` in the pipeline venv, to add plate boundaries/topologies (subduction zones, ridges) as a layer.
- Lighthouse CLI for the `visual-check` milestone pass.
- Node 24 in the cloud image (sessions currently have Node 22; everything passes on 22).
