// Shareable state: ?ma=250 opens the globe at 250 million years ago; ?b=1 shows plate boundaries;
// ?place=tokyo or ?pin=35.68,139.69 picks the pin.
import { clamp } from "./data/model";

/** Oldest time shown; matches OLDEST_MA in pipeline/build_frames.py and the slider max in index.html. */
export const MAX_MA = 750;

export function readMa(search: string): number | null {
  const raw = new URLSearchParams(search).get("ma");
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return clamp(Math.round(n), 0, MAX_MA);
}

/** ?b=1 opens with plate boundaries shown. */
export function readBoundaries(search: string): boolean {
  return new URLSearchParams(search).get("b") === "1";
}

function setParam(key: string, value: string | null): void {
  const url = new URL(location.href);
  if (value === null) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  history.replaceState(null, "", url);
}

export function writeMa(ma: number): void {
  setParam("ma", String(Math.round(ma)));
}

export function writeBoundaries(on: boolean): void {
  setParam("b", on ? "1" : null);
}

export function readPlace(search: string): string | null {
  return new URLSearchParams(search).get("place");
}

/** ?pin=lat,lon (degrees), or null when absent or out of range. */
export function readPin(search: string): { lat: number; lon: number } | null {
  const raw = new URLSearchParams(search).get("pin");
  if (!raw) return null;
  const [lat, lon] = raw.split(",").map((x) => (x.trim() === "" ? NaN : Number(x)));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export function writePlace(slug: string): void {
  setParam("pin", null);
  setParam("place", slug === "singapore" ? null : slug);
}

export function writePin(lat: number, lon: number): void {
  setParam("place", null);
  setParam("pin", `${lat.toFixed(2)},${lon.toFixed(2)}`);
}
