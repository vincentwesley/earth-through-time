// Shareable time: ?ma=250 opens the globe at 250 million years ago.
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

export function writeMa(ma: number): void {
  const url = new URL(location.href);
  url.searchParams.set("ma", String(Math.round(ma)));
  history.replaceState(null, "", url);
}
