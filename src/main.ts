import "./style.css";
import "./credits/credits.js";
import "./brand/logo-resize";
import { applyTheme, nextTheme, type Theme } from "./theme";
import { PlateLookup, Rotations, decodeBoundaries, decodeGeometry, distanceKm, toLatLon, clamp, type Manifest, type Pin } from "./data/model";
import { PLACES, placeBySlug } from "./data/places";
import { MOMENTS, describeMa, formatLatLon, formatMa, latitudeBand, periodAt } from "./data/timescale";
import { MAX_MA, readBoundaries, readMa, readPin, readPlace, writeBoundaries, writeMa, writePin, writePlace } from "./url";

const KEY = "theme";
const store = {
  get: (): Theme => {
    try {
      return localStorage.getItem(KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  },
  set: (t: Theme) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* storage blocked: theme just won't persist */
    }
  },
};

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const themeBtn = $<HTMLButtonElement>("#theme");
const slider = $<HTMLInputElement>("#time");
const maOut = $<HTMLOutputElement>("#ma");
const periodOut = $<HTMLElement>("#period");
const playBtn = $<HTMLButtonElement>("#play");
const status = $<HTMLElement>("#status");
const sgLat = $<HTMLElement>("#sg-pos");
const sgBand = $<HTMLElement>("#sg-band");
const sgDist = $<HTMLElement>("#sg-dist");
const sgNote = $<HTMLElement>("#sg-note");
const sgTitle = $<HTMLElement>("#h-sg");
const sgDesc = $<HTMLElement>("#sg-desc");
const placeSel = $<HTMLSelectElement>("#place");
const tapHint = $<HTMLElement>("#tap-hint");
const TAP_HINT = tapHint.textContent ?? "";
const SG_DESC = sgDesc.textContent ?? "";
const SG_NOTE = sgNote.textContent ?? "";
const label = $<HTMLElement>("#pin-label");
const boundsBtn = $<HTMLButtonElement>("#bounds");
const boundsKey = $<HTMLElement>("#bounds-key");

type GlobeT = import("./globe/globe").Globe;
let globe: GlobeT | null = null;
let palettes: typeof import("./globe/globe").PALETTES | null = null;
let manifest: Manifest | null = null;
let rotations: Rotations | null = null;
let lookup: PlateLookup | null = null;
let pin: Pin | null = null;

function syncTheme(t: Theme): void {
  applyTheme(t);
  themeBtn.setAttribute("aria-pressed", String(t === "light"));
  themeBtn.textContent = t === "light" ? "Dark theme" : "Light theme";
  if (globe && palettes) globe.applyPalette(palettes[t]);
}
syncTheme(store.get());
themeBtn.addEventListener("click", () => {
  const t = nextTheme(store.get());
  store.set(t);
  syncTheme(t);
});

function show(ma: number): void {
  ma = clamp(ma, 0, MAX_MA);
  slider.value = String(Math.round(ma));
  slider.setAttribute("aria-valuetext", describeMa(ma));
  maOut.value = formatMa(ma);
  const p = periodAt(ma);
  periodOut.textContent = ma <= 0 ? "Present day" : p.name;
  periodOut.style.setProperty("--period", p.color);
  if (!manifest || !globe) return;
  globe.setTime(ma);
  if (!pin) return;
  const [lat, lon] = toLatLon(globe.pinAt(ma));
  sgLat.textContent = formatLatLon(lat, lon);
  sgBand.textContent = latitudeBand(lat);
  sgDist.textContent = `${Math.round(distanceKm([lat, lon], [pin.lat, pin.lon])).toLocaleString("en")} km`;
  sgNote.hidden = pin.beginMa === manifest.noBegin || ma <= pin.beginMa;
}

let playing = false;
let last = 0;
function setPlaying(on: boolean): void {
  playing = on;
  playBtn.textContent = on ? "Pause" : "Play";
  playBtn.setAttribute("aria-pressed", String(on));
  if (on) {
    if (Number(slider.value) <= 0) show(MAX_MA);
    last = performance.now();
    requestAnimationFrame(step);
  }
}
function step(now: number): void {
  if (!playing) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const next = Math.max(0, (globe?.time ?? Number(slider.value)) - dt * 40); // 40 Myr per second
  show(next);
  if (next <= 0) {
    setPlaying(false);
    writeMa(0);
    return;
  }
  requestAnimationFrame(step);
}

slider.addEventListener("input", () => {
  setPlaying(false);
  show(Number(slider.value));
  writeMa(Number(slider.value));
});
playBtn.addEventListener("click", () => setPlaying(!playing));
$<HTMLButtonElement>("#focus").addEventListener("click", () => globe?.focusPin());

const moments = $<HTMLUListElement>("#moments");
for (const m of MOMENTS) {
  const li = document.createElement("li");
  const b = document.createElement("button");
  b.type = "button";
  b.className = "hs-chip";
  b.textContent = m.ma > 0 ? `${formatMa(m.ma)} · ${m.label}` : m.label;
  b.addEventListener("click", () => {
    setPlaying(false);
    show(m.ma);
    writeMa(m.ma);
  });
  li.append(b);
  moments.append(li);
}

let boundsOn = false;
function setBounds(on: boolean): void {
  boundsOn = on;
  boundsBtn.setAttribute("aria-pressed", String(on));
  boundsKey.hidden = !on;
  globe?.setBoundariesVisible(on);
}
boundsBtn.addEventListener("click", () => {
  setBounds(!boundsOn);
  writeBoundaries(boundsOn);
});

for (const p of PLACES) placeSel.add(new Option(p.name, p.slug));

/** Point the card, label and globe at a pin. */
function usePin(next: Pin, slug: string | null): void {
  if (!manifest) return;
  pin = next;
  const isSg = slug === "singapore";
  placeSel.value = slug ?? "";
  if (!slug) {
    if (!placeSel.querySelector('option[value=""]')) placeSel.add(new Option("Your pin", ""), 0);
    placeSel.value = "";
  } else placeSel.querySelector('option[value=""]')?.remove();
  sgTitle.textContent = slug ? `${next.name}'s rocks` : "Your pin's rocks";
  label.textContent = next.name;
  const plateId = manifest.plates[next.plateIndex];
  sgDesc.textContent = isSg
    ? SG_DESC
    : `The pin rides plate ${plateId} in the Merdith et al. (2021) model. The dashed line is its whole 750 Myr track.`;
  sgNote.textContent = isSg
    ? SG_NOTE
    : `The model's polygon for this spot begins at ${next.beginMa} Ma. Earlier positions follow plate ${plateId}'s rotation, so this crust may not have existed yet.`;
  globe?.setPin(next);
  show(Number(slider.value));
}

/** Build a pin from present-day coordinates, or null where the model has no plate. */
function pinFor(name: string, lat: number, lon: number): Pin | null {
  const hit = lookup?.at(lat, lon);
  return hit ? { name, lat, lon, ...hit } : null;
}

placeSel.addEventListener("change", () => {
  const p = placeBySlug(placeSel.value);
  const next = p && pinFor(p.name, p.lat, p.lon);
  if (!p || !next) return;
  usePin(next, p.slug);
  writePlace(p.slug);
  globe?.focusPin();
});

show(readMa(location.search) ?? 250);
setBounds(readBoundaries(location.search));

async function load(): Promise<void> {
  const base = `${import.meta.env.BASE_URL}frames/`;
  const get = async (file: string) => {
    const res = await fetch(base + file);
    if (!res.ok) throw new DataError(`${file}: HTTP ${res.status}`);
    return res;
  };
  manifest = (await (await get("manifest.json")).json()) as Manifest;
  const [g, r, b, l, mod] = await Promise.all([
    get(manifest.geometry.file).then((x) => x.arrayBuffer()),
    get(manifest.rotations.file).then((x) => x.arrayBuffer()),
    get(manifest.boundaries.file).then((x) => x.arrayBuffer()),
    get(manifest.lookup.file).then((x) => x.arrayBuffer()),
    import("./globe/globe"),
  ]);
  rotations = new Rotations(manifest, new Int16Array(r));
  lookup = new PlateLookup(manifest.lookup, l);
  const s = manifest.singapore;
  const singapore: Pin = { name: "Singapore", lat: s.lat, lon: s.lon, plateIndex: s.plateIndex, beginMa: s.polygonBeginMa };
  const fromUrl = readPin(location.search);
  const place = placeBySlug(readPlace(location.search));
  let first: [Pin, string | null] = [singapore, "singapore"];
  const urlPin = fromUrl && pinFor("Your pin", fromUrl.lat, fromUrl.lon);
  const placePin = place && place.slug !== "singapore" && pinFor(place.name, place.lat, place.lon);
  if (urlPin) first = [urlPin, null];
  else if (placePin && place) first = [placePin, place.slug];
  palettes = mod.PALETTES;
  const canvas = $<HTMLCanvasElement>("#globe");
  globe = new mod.Globe({
    canvas,
    manifest,
    geometry: decodeGeometry(manifest, g),
    rotations,
    boundaries: decodeBoundaries(manifest, b),
    pin: first[0],
    reducedMotion,
  });
  globe.setBoundariesVisible(boundsOn);
  usePin(...first);
  globe.onTap((lat, lon) => {
    if ((globe?.time ?? 0) > 0.5) {
      tapHint.textContent = "Go to Today to drop a pin: past positions can't be traced back to one plate.";
      return;
    }
    const next = pinFor("Your pin", lat, lon);
    if (!next) {
      tapHint.textContent = "No plate data here in the model.";
      return;
    }
    tapHint.textContent = TAP_HINT;
    usePin(next, null);
    writePin(lat, lon);
  });
  globe.applyPalette(palettes[store.get()]);
  globe.onRender(() => {
    const p = globe!.pinScreen();
    label.hidden = !p;
    if (p) label.style.transform = `translate(${p.x}px, ${p.y}px)`;
  });
  show(Number(slider.value));
  globe.focusPin();
  status.textContent = "";
  document.body.dataset.ready = "true";
}

class DataError extends Error {}

load().catch((err: unknown) => {
  console.error(err);
  status.textContent =
    err instanceof DataError
      ? "Could not load the plate model. Check your connection and reload."
      : "Could not start the 3D globe. It needs WebGL 2; try a recent Chrome, Firefox, Safari or Edge.";
});
