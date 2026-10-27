import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Rotations, decodeGeometry, distanceKm, rotate, slerp, toLatLon, toXyz, type Manifest, type Quat } from "../src/data/model";

const dir = new URL("../public/frames/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8")) as Manifest;
const toAB = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const rot = new Rotations(manifest, new Int16Array(toAB(readFileSync(new URL("rotations.bin", dir)))));

describe("lat/lon maths", () => {
  it("round-trips", () => {
    const [la, lo] = toLatLon(toXyz(1.29, 103.85));
    expect(la).toBeCloseTo(1.29, 9);
    expect(lo).toBeCloseTo(103.85, 9);
  });
  it("rotates 90° about z", () => {
    const q: Quat = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
    const v = rotate(q, [1, 0, 0]);
    expect(v[1]).toBeCloseTo(1, 9);
  });
  it("measures a quarter meridian", () => {
    expect(distanceKm([0, 0], [90, 0])).toBeCloseTo((Math.PI / 2) * 6371, 3);
  });
  it("slerp halfway", () => {
    const q = slerp([0, 0, 0, 1], [0, 0, 1, 0], 0.5);
    expect(q[2]).toBeCloseTo(Math.SQRT1_2, 9);
  });
});

describe("shipped plate model", () => {
  it("decodes geometry sections that match the manifest", () => {
    const g = decodeGeometry(manifest, toAB(readFileSync(new URL("geometry.bin", dir))));
    expect(g.fillPosition.length % 3).toBe(0);
    expect(g.fillAttr.length).toBe(g.fillPosition.length);
    const verts = g.fillPosition.length / 3;
    expect(Math.max(...g.fillIndex.subarray(0, 5000))).toBeLessThan(verts);
    for (let i = 0; i < g.fillAttr.length; i += 3) expect(g.fillAttr[i]).toBeLessThan(manifest.plates.length);
  });

  it("puts Singapore where pyGPlates does, at every 5 Myr step", () => {
    const s = manifest.singapore;
    s.path.forEach(([lat, lon], i) => {
      const ma = i * s.pathStepMa;
      const [la, lo] = toLatLon(rotate(rot.at(s.plateIndex, ma), toXyz(s.lat, s.lon)));
      expect(distanceKm([la, lo], [lat, lon])).toBeLessThan(2);
    });
  });

  it("interpolates smoothly between frames", () => {
    const s = manifest.singapore;
    const p = (ma: number) => toLatLon(rotate(rot.at(s.plateIndex, ma), toXyz(s.lat, s.lon)));
    expect(distanceKm(p(240.5), p(240))).toBeLessThan(150);
    expect(p(0)[0]).toBeCloseTo(1.29, 2);
  });
});
