import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PlateLookup, Rotations, distanceKm, trackOf, type Manifest, type Pin } from "../src/data/model";
import { PLACES, placeBySlug } from "../src/data/places";
import { readPin, readPlace } from "../src/url";

const dir = new URL("../public/frames/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8")) as Manifest;
const ab = (name: string) => {
  const b = readFileSync(new URL(name, dir));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const lookup = new PlateLookup(manifest.lookup, ab("lookup.bin"));
const rot = new Rotations(manifest, new Int16Array(ab("rotations.bin")));

describe("present-day plate lookup", () => {
  it("puts Singapore on the same plate the pipeline found", () => {
    const hit = lookup.at(1.29, 103.85)!;
    expect(manifest.plates[hit.plateIndex]).toBe(manifest.singapore.plateId);
    expect(hit.beginMa).toBe(410);
  });

  it("finds young Pacific crust near the East Pacific Rise", () => {
    const hit = lookup.at(-30, -120)!;
    expect(manifest.plates[hit.plateIndex]).toBe(901);
    expect(hit.beginMa).toBeLessThan(50);
  });

  it("wraps longitudes", () => {
    expect(lookup.at(1.29, 103.85 - 360)).toEqual(lookup.at(1.29, 103.85));
  });

  it("covers every place in the picker", () => {
    for (const p of PLACES) expect(lookup.at(p.lat, p.lon), p.name).not.toBeNull();
  });
});

describe("pin tracks", () => {
  it("start at the pin today and match the shipped Singapore path", () => {
    const s = manifest.singapore;
    const pin: Pin = { name: "Singapore", lat: s.lat, lon: s.lon, plateIndex: s.plateIndex, beginMa: s.polygonBeginMa };
    const track = trackOf(rot, pin, manifest.oldestMa, 5);
    expect(track.length).toBe(151);
    expect(distanceKm(track[0], [s.lat, s.lon])).toBeLessThan(1);
    track.forEach((p, i) => expect(distanceKm(p, s.path[i])).toBeLessThan(2));
  });
});

describe("pin URL state", () => {
  it("reads ?pin= and ?place=", () => {
    expect(readPin("?pin=35.68,139.69")).toEqual({ lat: 35.68, lon: 139.69 });
    expect(readPin("?pin=95,0")).toBeNull();
    expect(readPin("?pin=abc")).toBeNull();
    expect(readPin("?pin=1,")).toBeNull();
    expect(readPlace("?place=tokyo")).toBe("tokyo");
    expect(placeBySlug("tokyo")?.name).toBe("Tokyo");
    expect(placeBySlug("atlantis")).toBeUndefined();
  });
});
