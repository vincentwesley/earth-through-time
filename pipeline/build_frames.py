"""Build the static plate-reconstruction data the globe ships with.

Reads the Merdith et al. (2021) 1 Ga plate model (EarthByte, CC BY 4.0) and writes
compact binaries to public/frames/:

  geometry.bin   present-day continent + coastline polygons, triangulated on the
                 sphere, plus coastline outlines. Each vertex carries its plate
                 and its valid-time window.
  rotations.bin  one unit quaternion per plate per 1 Myr step (750 Ma -> 0),
                 straight from the model's rotation file via pyGPlates.
  manifest.json  section offsets, times, plate list, model citation, hashes.

The browser reconstructs any time by rotating each vertex with its plate's
quaternion, which is exactly what pygplates.reconstruct does for these
plate-ID-only features (checked by --verify against pygplates itself).

Usage (from the repo root):
  python -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
  .venv/bin/python -I pipeline/build_frames.py --cache /some/empty/dir
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
import urllib.request
import zipfile
from pathlib import Path

import mapbox_earcut as earcut
import numpy as np
import pygplates
import shapely
from shapely.geometry import Polygon

MODEL_URL = (
    "https://www.earthbyte.org/webdav/ftp/Data_Collections/Merdith_etal_2021_ESR/"
    "SM2-Merdith_et_al_1_Ga_reconstruction_v1.2.4.zip"
)
MODEL_SHA256 = "ea247ec5f8975fb7e6034c8ec48704b11805fc6f520ee7526c5757b830386982"
MODEL_DIR = "SM2-Merdith_et_al_1_Ga_reconstruction_v1.2.4"
ROT_FILE = "1000_0_rotfile_Merdith_et_al.rot"
STATIC_POLYGONS = "shapes_static_polygons_Merdith_et_al.gpml"
LAYERS = [
    ("continents", "shapes_continents.gpml"),
    ("coastlines", "shapes_coastlines_Merdith_et_al_v2.gpmlz"),
]

OLDEST_MA = 750
STEP_MA = 1
SIMPLIFY_RAD = 0.0025  # ~16 km on the ground
MIN_AREA_SR = 2e-6  # drop slivers smaller than ~80 km^2
MAX_EDGE_RAD = math.radians(2.5)  # subdivide so fills hug the sphere
LINE_SEG_RAD = math.radians(1.0)
NO_BEGIN = 0xFFFF  # "exists before the oldest frame"

SINGAPORE = (1.29, 103.85)  # lat, lon (Singapore Island, city centre)

OUT = Path(__file__).resolve().parent.parent / "public" / "frames"


# ---------------------------------------------------------------- geometry ---


def unit(lat: float, lon: float) -> np.ndarray:
    la, lo = math.radians(lat), math.radians(lon)
    return np.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])


def frame_at(center: np.ndarray):
    """Orthonormal tangent frame (e1, e2, n) at center for a Lambert azimuthal projection."""
    n = center / np.linalg.norm(center)
    helper = np.array([0.0, 0.0, 1.0]) if abs(n[2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    e1 = np.cross(helper, n)
    e1 /= np.linalg.norm(e1)
    e2 = np.cross(n, e1)
    return e1, e2, n


def project(xyz: np.ndarray, fr) -> np.ndarray:
    e1, e2, n = fr
    c = np.clip(xyz @ n, -0.999999, 1.0)
    k = np.sqrt(2.0 / (1.0 + c))
    return np.stack([k * (xyz @ e1), k * (xyz @ e2)], axis=1)


def unproject(xy: np.ndarray, fr) -> np.ndarray:
    e1, e2, n = fr
    rho2 = np.sum(xy * xy, axis=1)
    rho = np.sqrt(rho2)
    c = 2.0 * np.arcsin(np.clip(rho / 2.0, 0.0, 1.0))
    with np.errstate(invalid="ignore", divide="ignore"):
        s = np.where(rho > 0, np.sin(c) / rho, 1.0)
    out = np.outer(np.cos(c), n) + (xy[:, :1] * s[:, None]) * e1 + (xy[:, 1:] * s[:, None]) * e2
    return out / np.linalg.norm(out, axis=1)[:, None]


def ring_xyz(points) -> np.ndarray:
    return np.array([p.to_xyz() for p in points], dtype=float)


def refine(verts: list, tris: list) -> tuple[list, list]:
    """Conforming red-green refinement: split every edge longer than MAX_EDGE_RAD."""
    while True:
        mids: dict[tuple[int, int], int] = {}

        def long(a: int, b: int) -> bool:
            return math.acos(max(-1.0, min(1.0, float(np.dot(verts[a], verts[b]))))) > MAX_EDGE_RAD

        def mid(a: int, b: int) -> int:
            key = (a, b) if a < b else (b, a)
            if key not in mids:
                m = verts[a] + verts[b]
                verts.append(m / np.linalg.norm(m))
                mids[key] = len(verts) - 1
            return mids[key]

        marked = set()
        for a, b, c in tris:
            for u, v in ((a, b), (b, c), (c, a)):
                if long(u, v):
                    marked.add((u, v) if u < v else (v, u))
        if not marked:
            return verts, tris
        out = []
        for a, b, c in tris:
            ab = (min(a, b), max(a, b)) in marked
            bc = (min(b, c), max(b, c)) in marked
            ca = (min(c, a), max(c, a)) in marked
            k = ab + bc + ca
            if k == 0:
                out.append((a, b, c))
            elif k == 3:
                x, y, z = mid(a, b), mid(b, c), mid(c, a)
                out += [(a, x, z), (x, b, y), (z, y, c), (x, y, z)]
            else:
                # rotate so the first marked edge is (a, b)
                while not ((min(a, b), max(a, b)) in marked):
                    a, b, c = b, c, a
                x = mid(a, b)
                if (min(b, c), max(b, c)) in marked:
                    y = mid(b, c)
                    out += [(a, x, c), (x, b, y), (x, y, c)]
                elif (min(c, a), max(c, a)) in marked:
                    z = mid(c, a)
                    out += [(x, b, c), (a, x, z), (x, c, z)]
                else:
                    out += [(a, x, c), (x, b, c)]
        tris = out


def densify(ring: np.ndarray) -> np.ndarray:
    pts = []
    for i in range(len(ring)):
        a, b = ring[i], ring[(i + 1) % len(ring)]
        ang = math.acos(max(-1.0, min(1.0, float(a @ b))))
        n = max(1, math.ceil(ang / LINE_SEG_RAD))
        for k in range(n):
            t = k / n
            if ang < 1e-9:
                p = a
            else:
                p = (math.sin((1 - t) * ang) * a + math.sin(t * ang) * b) / math.sin(ang)
            pts.append(p / np.linalg.norm(p))
    return np.array(pts)


def polygon_parts(poly: pygplates.PolygonOnSphere):
    """Simplify one spherical polygon; yield (fr, shapely polygon in projected plane)."""
    ext = ring_xyz(poly.get_exterior_ring_points())
    holes = [ring_xyz(poly.get_interior_ring_points(i)) for i in range(poly.get_number_of_interior_rings())]
    center = ext.mean(axis=0)
    if np.linalg.norm(center) < 1e-6:
        return
    fr = frame_at(center)
    shp = Polygon(project(ext, fr), [project(h, fr) for h in holes])
    shp = shapely.make_valid(shp).simplify(SIMPLIFY_RAD, preserve_topology=True)
    geoms = getattr(shp, "geoms", [shp])
    for g in geoms:
        if g.geom_type == "Polygon" and g.area > MIN_AREA_SR:
            yield fr, g
        elif g.geom_type in ("MultiPolygon", "GeometryCollection"):
            for h in g.geoms:
                if h.geom_type == "Polygon" and h.area > MIN_AREA_SR:
                    yield fr, h


def triangulate(fr, g: Polygon):
    rings = [np.asarray(g.exterior.coords)[:-1]] + [np.asarray(r.coords)[:-1] for r in g.interiors]
    rings = [r for r in rings if len(r) >= 3]
    flat = np.concatenate(rings).astype(np.float64)
    ends = np.cumsum([len(r) for r in rings]).astype(np.uint32)
    idx = earcut.triangulate_float64(flat, ends).reshape(-1, 3)
    verts = list(unproject(flat, fr))
    tris = [tuple(int(i) for i in t) for t in idx]
    verts, tris = refine(verts, tris)
    outlines = [unproject(r, fr) for r in rings]
    return np.array(verts), np.array(tris, dtype=np.int64).reshape(-1, 3), outlines


# ---------------------------------------------------------------- rotations --


def quat(rot: pygplates.FiniteRotation) -> np.ndarray:
    """Unit quaternion (x, y, z, w) in pyGPlates' Earth-centred frame."""
    if rot.represents_identity_rotation():
        return np.array([0.0, 0.0, 0.0, 1.0])
    lat, lon, ang = rot.get_lat_lon_euler_pole_and_angle_degrees()
    axis = unit(lat, lon)
    h = math.radians(ang) / 2.0
    return np.concatenate([axis * math.sin(h), [math.cos(h)]])


def qrot(q: np.ndarray, v: np.ndarray) -> np.ndarray:
    u, w = q[:3], q[3]
    return v + 2.0 * np.cross(u, np.cross(u, v) + w * v)


# ---------------------------------------------------------------- pipeline ---


def fetch_model(cache: Path) -> Path:
    cache.mkdir(parents=True, exist_ok=True)
    model = cache / MODEL_DIR
    if model.exists():
        return model
    zpath = cache / "model.zip"
    if not zpath.exists():
        print("downloading", MODEL_URL)
        urllib.request.urlretrieve(MODEL_URL, zpath)
    digest = hashlib.sha256(zpath.read_bytes()).hexdigest()
    print("model zip sha256", digest)
    if MODEL_SHA256 and digest != MODEL_SHA256:
        sys.exit("model zip hash mismatch")
    with zipfile.ZipFile(zpath) as z:
        for name in z.namelist():
            if name.startswith(MODEL_DIR + "/") and not name.endswith("/"):
                z.extract(name, cache)
    return model


def valid_window(feature) -> tuple[int, int]:
    begin, end = feature.get_valid_time()
    b = NO_BEGIN if (math.isinf(begin) or begin > OLDEST_MA) else int(math.ceil(begin))
    e = 0 if (math.isinf(end) or end < 0) else int(math.floor(end))
    return b, e


def build(model: Path, verify: bool) -> dict:
    rot_model = pygplates.RotationModel(str(model / ROT_FILE))

    plates: dict[int, int] = {}

    def plate_index(pid: int) -> int:
        if pid not in plates:
            plates[pid] = len(plates)
        return plates[pid]

    fill_pos, fill_attr, fill_idx = [], [], []
    line_pos, line_attr, line_idx = [], [], []
    layers_meta = []
    nfill = nline = 0

    for name, fname in LAYERS:
        idx_start = sum(len(i) for i in fill_idx)
        lidx_start = sum(len(i) for i in line_idx)
        kept = 0
        for feature in pygplates.FeatureCollection(str(model / fname)):
            b, e = valid_window(feature)
            if e > OLDEST_MA or (b != NO_BEGIN and b < e):
                continue
            pid = feature.get_reconstruction_plate_id()
            pi = plate_index(pid)
            for geom in feature.get_geometries():
                if not isinstance(geom, pygplates.PolygonOnSphere):
                    continue
                for fr, g in polygon_parts(geom):
                    verts, tris, outlines = triangulate(fr, g)
                    if len(tris) == 0:
                        continue
                    fill_pos.append(verts)
                    fill_attr.append(np.tile([pi, b, e], (len(verts), 1)))
                    fill_idx.append(tris.reshape(-1) + nfill)
                    nfill += len(verts)
                    if name == "coastlines":
                        for ring in outlines:
                            d = densify(ring)
                            n = len(d)
                            line_pos.append(d)
                            line_attr.append(np.tile([pi, b, e], (n, 1)))
                            seg = np.stack([np.arange(n), (np.arange(n) + 1) % n], axis=1).reshape(-1)
                            line_idx.append(seg + nline)
                            nline += n
                    kept += 1
        layers_meta.append(
            {
                "name": name,
                "fill": [idx_start, sum(len(i) for i in fill_idx) - idx_start],
                "lines": [lidx_start, sum(len(i) for i in line_idx) - lidx_start],
                "parts": kept,
            }
        )
        print(f"{name}: {kept} polygons")

    # Singapore: find its plate from the model's static polygons.
    sg_point = pygplates.PointOnSphere(*SINGAPORE)
    sg_feature = None
    for f in pygplates.FeatureCollection(str(model / STATIC_POLYGONS)):
        for g in f.get_geometries():
            if isinstance(g, pygplates.PolygonOnSphere) and g.is_point_in_polygon(sg_point):
                sg_feature = f
    assert sg_feature is not None, "Singapore not inside any static polygon"
    sg_pid = sg_feature.get_reconstruction_plate_id()
    plate_index(sg_pid)
    sg_begin, _ = valid_window(sg_feature)

    pids = list(plates.keys())
    times = list(range(0, OLDEST_MA + 1, STEP_MA))
    q = np.zeros((len(times), len(pids), 4))
    for ti, t in enumerate(times):
        for pi, pid in enumerate(pids):
            qq = quat(rot_model.get_rotation(float(t), pid))
            if ti > 0 and np.dot(qq, q[ti - 1, pi]) < 0:
                qq = -qq  # keep the hemisphere continuous so slerp takes the short way
            q[ti, pi] = qq

    if verify:
        verify_against_pygplates(model, rot_model, plates, q, times)

    sg_path = []
    p0 = unit(*SINGAPORE)
    for ti, t in enumerate(times):
        v = qrot(q[ti, plates[sg_pid]], p0)
        sg_path.append([round(math.degrees(math.asin(v[2])), 3), round(math.degrees(math.atan2(v[1], v[0])), 3)])

    # ---- serialise ----
    OUT.mkdir(parents=True, exist_ok=True)
    sections = []
    blob = bytearray()

    def add(name: str, arr: np.ndarray, dtype: str):
        nonlocal blob
        while len(blob) % 4:
            blob += b"\0"
        a = np.ascontiguousarray(arr.astype(dtype))
        sections.append({"name": name, "type": dtype, "offset": len(blob), "length": int(a.size)})
        blob += a.tobytes()

    def i16(x: np.ndarray) -> np.ndarray:
        return np.round(np.clip(x, -1, 1) * 32767).astype("<i2")

    fp = np.concatenate(fill_pos)
    lp = np.concatenate(line_pos)
    add("fillPosition", i16(fp).reshape(-1), "<i2")
    add("fillAttr", np.concatenate(fill_attr).reshape(-1), "<u2")
    add("fillIndex", np.concatenate(fill_idx), "<u4")
    add("linePosition", i16(lp).reshape(-1), "<i2")
    add("lineAttr", np.concatenate(line_attr).reshape(-1), "<u2")
    add("lineIndex", np.concatenate(line_idx), "<u4")
    (OUT / "geometry.bin").write_bytes(bytes(blob))

    rot_bytes = i16(q).reshape(-1).tobytes()
    (OUT / "rotations.bin").write_bytes(rot_bytes)

    manifest = {
        "version": 1,
        "model": {
            "name": "Merdith et al. (2021) 1 Ga full-plate model, v1.2.4",
            "url": MODEL_URL,
            "licence": "CC BY 4.0 (Zenodo 10.5281/zenodo.13635864)",
        },
        "oldestMa": OLDEST_MA,
        "stepMa": STEP_MA,
        "frames": len(times),
        "plates": pids,
        "noBegin": NO_BEGIN,
        "geometry": {"file": "geometry.bin", "bytes": len(blob), "sha256": hashlib.sha256(blob).hexdigest(), "sections": sections},
        "rotations": {"file": "rotations.bin", "bytes": len(rot_bytes), "sha256": hashlib.sha256(rot_bytes).hexdigest(), "type": "<i2", "layout": "frame,plate,xyzw"},
        "layers": layers_meta,
        "singapore": {
            "lat": SINGAPORE[0],
            "lon": SINGAPORE[1],
            "plateId": sg_pid,
            "plateIndex": plates[sg_pid],
            "plateName": sg_feature.get_name(),
            "polygonBeginMa": sg_begin,
            "path": sg_path[:: max(1, 5 // STEP_MA)],
            "pathStepMa": max(1, 5 // STEP_MA) * STEP_MA,
        },
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")) + "\n")
    for f in ("geometry.bin", "rotations.bin", "manifest.json"):
        size = (OUT / f).stat().st_size
        print(f"{f}: {size / 1024:.0f} KiB")
        assert size < 25 * 1024 * 1024, f"{f} over 25 MiB"
    return manifest


def verify_against_pygplates(model: Path, rot_model, plates, q, times):
    """Rotating present-day vertices by our quaternions must match pygplates.reconstruct."""
    worst = 0.0
    for _, fname in LAYERS:
        fc = pygplates.FeatureCollection(str(model / fname))
        sample = [f for f in fc][:: max(1, len(fc) // 40)]
        for t in (0, 100, 250, 410, 600, 750):
            out = []
            pygplates.reconstruct(sample, rot_model, out, float(t))
            for r in out:
                f = r.get_feature()
                pid = f.get_reconstruction_plate_id()
                if pid not in plates:
                    continue
                src = r.get_present_day_geometry().get_points()[0].to_xyz()
                dst = np.array(r.get_reconstructed_geometry().get_points()[0].to_xyz())
                got = qrot(q[times.index(t), plates[pid]], np.array(src))
                worst = max(worst, math.degrees(math.acos(min(1.0, float(got @ dst)))))
    print(f"verify: worst vertex error vs pygplates.reconstruct = {worst:.6f} deg")
    assert worst < 1e-4, "quaternion reconstruction disagrees with pyGPlates"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", type=Path, required=True, help="empty dir for the model download")
    ap.add_argument("--no-verify", action="store_true")
    args = ap.parse_args()
    build(fetch_model(args.cache), verify=not args.no_verify)


if __name__ == "__main__":
    main()
