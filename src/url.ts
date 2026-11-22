// Shareable state: ?ma=250 opens the globe at 250 million years ago; ?b=1 shows plate boundaries.
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
