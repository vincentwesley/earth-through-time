// Decodes the static plate model written by pipeline/build_frames.py and does the
// small amount of sphere maths the globe needs (quaternions, lat/lon, distances).
// Layouts and conventions follow that script: Earth-centred frame with z = north,
// quaternions as (x, y, z, w), Int16 values scaled by 32767.

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export interface Section {
  name: string;
  type: "<i2" | "<u2" | "<u4";
  /** Byte offset into geometry.bin (4-byte aligned). */
  offset: number;
  /** Element count. */
  length: number;
}

export interface Layer {
  name: string;
  /** [first index, index count] into fillIndex. */
  fill: [number, number];
  /** [first index, index count] into lineIndex. */
  lines: [number, number];
  parts: number;
}

export interface Manifest {
  version: number;
  model: { name: string; url: string; licence: string };
  oldestMa: number;
  stepMa: number;
  frames: number;
  /** Plate IDs; a plate's position here is its plate index. */
  plates: number[];
  /** Begin-time value meaning "exists before the oldest frame". */
  noBegin: number;
  geometry: { file: string; bytes: number; sha256: string; sections: Section[] };
  rotations: { file: string; bytes: number; sha256: string; type: "<i2"; layout: "frame,plate,xyzw" };
  layers: Layer[];
  boundaries: BoundaryMeta;
  singapore: {
    lat: number;
    lon: number;
    plateId: number;
    plateIndex: number;
    plateName: string;
    polygonBeginMa: number;
    /** [lat, lon] every pathStepMa from today back to oldestMa. */
    path: [number, number][];
    pathStepMa: number;
  };
}

export const BOUNDARY_TYPES = ["SubductionZone", "MidOceanRidge", "Transform", "other"] as const;
export type BoundaryType = (typeof BOUNDARY_TYPES)[number];

export interface BoundaryMeta {
  file: string;
  bytes: number;
  sha256: string;
  stepMa: number;
  frames: number;
  types: BoundaryType[];
  sections: Section[];
}

/** Resolved plate boundaries, already at their position for each frame (no rotation needed). */
export interface Boundaries {
  /** offsets[frame * types + type] .. offsets[... + 1] is that line set's vertex range. */
  offsets: Uint32Array;
  /** Segment end points as Int16 xyz pairs. */
  position: Int16Array;
}

export function decodeBoundaries(manifest: Manifest, buf: ArrayBuffer): Boundaries {
  const m = manifest.boundaries;
  if (buf.byteLength !== m.bytes) throw new Error("boundaries.bin: size does not match manifest");
  const get = (name: keyof Boundaries) => {
    const s = m.sections.find((x) => x.name === name);
    if (!s) throw new Error(`boundaries.bin: missing section ${name}`);
    return new ARRAYS[s.type](buf, s.offset, s.length);
  };
  const out = { offsets: get("offsets") as Uint32Array, position: get("position") as Int16Array };
  if (out.offsets.length !== m.frames * m.types.length + 1) throw new Error("boundaries.bin: offset table does not match manifest");
  return out;
}

/** Boundaries are resolved every stepMa; show the nearest frame. */
export function boundaryFrameAt(meta: BoundaryMeta, ma: number): number {
  return clamp(Math.round(ma / meta.stepMa), 0, meta.frames - 1);
}

/** [first vertex, vertex count] of one boundary type in one frame. */
export function boundaryRange(meta: BoundaryMeta, b: Boundaries, frame: number, type: number): [number, number] {
  const i = frame * meta.types.length + type;
  return [b.offsets[i], b.offsets[i + 1] - b.offsets[i]];
}

export interface Geometry {
  fillPosition: Int16Array;
  /** Per vertex: plate index, begin Ma, end Ma. */
  fillAttr: Uint16Array;
  fillIndex: Uint32Array;
  linePosition: Int16Array;
  lineAttr: Uint16Array;
  lineIndex: Uint32Array;
}

const EARTH_RADIUS_KM = 6371;
const I16 = 32767;
const DEG = Math.PI / 180;

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

const ARRAYS = { "<i2": Int16Array, "<u2": Uint16Array, "<u4": Uint32Array } as const;

export function decodeGeometry(manifest: Manifest, buf: ArrayBuffer): Geometry {
  const get = (name: keyof Geometry) => {
    const s = manifest.geometry.sections.find((x) => x.name === name);
    if (!s) throw new Error(`geometry.bin: missing section ${name}`);
    return new ARRAYS[s.type](buf, s.offset, s.length);
  };
  return {
    fillPosition: get("fillPosition") as Int16Array,
    fillAttr: get("fillAttr") as Uint16Array,
    fillIndex: get("fillIndex") as Uint32Array,
    linePosition: get("linePosition") as Int16Array,
    lineAttr: get("lineAttr") as Uint16Array,
    lineIndex: get("lineIndex") as Uint32Array,
  };
}

/** Each plate's finite rotation, sampled every stepMa; slerped in between. */
export class Rotations {
  readonly plates: number;

  constructor(
    private readonly manifest: Manifest,
    private readonly data: Int16Array,
  ) {
    this.plates = manifest.plates.length;
    if (data.length !== manifest.frames * this.plates * 4) throw new Error("rotations.bin: size does not match manifest");
  }

  private sample(frame: number, plate: number): Quat {
    const i = (frame * this.plates + plate) * 4;
    const d = this.data;
    return normalize([d[i] / I16, d[i + 1] / I16, d[i + 2] / I16, d[i + 3] / I16]);
  }

  /** Rotation of `plate` (an index into manifest.plates) at `ma`. */
  at(plate: number, ma: number): Quat {
    const f = clamp(ma, 0, this.manifest.oldestMa) / this.manifest.stepMa;
    const i = Math.min(Math.floor(f), this.manifest.frames - 1);
    const t = f - i;
    if (t <= 0 || i >= this.manifest.frames - 1) return this.sample(i, plate);
    return slerp(this.sample(i, plate), this.sample(i + 1, plate), t);
  }

  /** Writes every plate's rotation at `ma` into `out` as x, y, z, w per plate. */
  fill(out: Float32Array, ma: number): void {
    for (let p = 0; p < this.plates; p++) out.set(this.at(p, ma), p * 4);
  }
}

function normalize(q: Quat): Quat {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

export function slerp(a: Quat, b: Quat, t: number): Quat {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let s = 1;
  if (dot < 0) {
    dot = -dot;
    s = -1; // take the short way round
  }
  if (dot > 0.9995) {
    return normalize([
      a[0] + (s * b[0] - a[0]) * t,
      a[1] + (s * b[1] - a[1]) * t,
      a[2] + (s * b[2] - a[2]) * t,
      a[3] + (s * b[3] - a[3]) * t,
    ]);
  }
  const th = Math.acos(dot);
  const sin = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / sin;
  const wb = (s * Math.sin(t * th)) / sin;
  return [wa * a[0] + wb * b[0], wa * a[1] + wb * b[1], wa * a[2] + wb * b[2], wa * a[3] + wb * b[3]];
}

/** Rotates v by unit quaternion q (same formula as qrot in the pipeline and the shader). */
export function rotate(q: Quat, v: Vec3): Vec3 {
  const [x, y, z, w] = q;
  // t = 2 * cross(q.xyz, v); v' = v + w t + cross(q.xyz, t)
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}

export function toXyz(lat: number, lon: number): Vec3 {
  const la = lat * DEG;
  const lo = lon * DEG;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

export function toLatLon(v: Vec3): [number, number] {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [Math.asin(clamp(v[2] / n, -1, 1)) / DEG, Math.atan2(v[1], v[0]) / DEG];
}

/** Great-circle distance between two [lat, lon] points (haversine, mean Earth radius). */
export function distanceKm(a: [number, number], b: [number, number]): number {
  const dLat = (b[0] - a[0]) * DEG;
  const dLon = (b[1] - a[1]) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * DEG) * Math.cos(b[0] * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
