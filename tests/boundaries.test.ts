import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOUNDARY_TYPES, boundaryFrameAt, boundaryRange, decodeBoundaries, type Manifest } from "../src/data/model";
import { readBoundaries } from "../src/url";

const dir = new URL("../public/frames/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8")) as Manifest;
const raw = readFileSync(new URL("boundaries.bin", dir));
const b = decodeBoundaries(manifest, raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer);
const meta = manifest.boundaries;

describe("plate boundaries", () => {
  it("matches the client's type order", () => {
    expect(meta.types).toEqual([...BOUNDARY_TYPES]);
  });

  it("has one frame every 5 Myr from today to 750 Ma", () => {
    expect(meta.frames).toBe(manifest.oldestMa / meta.stepMa + 1);
    expect(b.offsets[b.offsets.length - 1] * 3).toBe(b.position.length);
  });

  it("snaps to the nearest frame", () => {
    expect(boundaryFrameAt(meta, 0)).toBe(0);
    expect(boundaryFrameAt(meta, 252)).toBe(50);
    expect(boundaryFrameAt(meta, 253)).toBe(51);
    expect(boundaryFrameAt(meta, 9999)).toBe(meta.frames - 1);
  });

  it("has subduction zones, ridges and transforms today and at 600 Ma", () => {
    for (const ma of [0, 600]) {
      const f = boundaryFrameAt(meta, ma);
      for (let t = 0; t < 3; t++) {
        const [, count] = boundaryRange(meta, b, f, t);
        expect(count).toBeGreaterThan(0);
        expect(count % 2).toBe(0); // vertex pairs = segments
      }
    }
  });

  it("stores points on the unit sphere", () => {
    for (let i = 0; i < b.position.length; i += 999) {
      const v = [b.position[i - (i % 3)], b.position[i - (i % 3) + 1], b.position[i - (i % 3) + 2]].map((x) => x / 32767);
      expect(Math.hypot(v[0], v[1], v[2])).toBeCloseTo(1, 3);
    }
  });

  it("reads ?b=1", () => {
    expect(readBoundaries("?b=1")).toBe(true);
    expect(readBoundaries("?b=0")).toBe(false);
    expect(readBoundaries("")).toBe(false);
  });
});
