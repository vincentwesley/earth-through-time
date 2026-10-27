import "./style.css";
import "./credits/credits.js";
import { applyTheme, nextTheme, type Theme } from "./theme";
import { Rotations, decodeGeometry, distanceKm, toLatLon, clamp, type Manifest } from "./data/model";
import { MOMENTS, describeMa, formatLatLon, formatMa, latitudeBand, periodAt } from "./data/timescale";
import { MAX_MA, readMa, writeMa } from "./url";

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
const label = $<HTMLElement>("#pin-label");

type GlobeT = import("./globe/globe").Globe;
let globe: GlobeT | null = null;
let palettes: typeof import("./globe/globe").PALETTES | null = null;
let manifest: Manifest | null = null;
let rotations: Rotations | null = null;

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
  const s = manifest.singapore;
  const [lat, lon] = toLatLon(globe.singaporeAt(ma));
  sgLat.textContent = formatLatLon(lat, lon);
  sgBand.textContent = latitudeBand(lat);
  sgDist.textContent = `${Math.round(distanceKm([lat, lon], [s.lat, s.lon])).toLocaleString("en")} km`;
  sgNote.hidden = ma <= s.polygonBeginMa;
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

show(readMa(location.search) ?? 250);

async function load(): Promise<void> {
  const base = `${import.meta.env.BASE_URL}frames/`;
  const get = async (file: string) => {
    const res = await fetch(base + file);
    if (!res.ok) throw new DataError(`${file}: HTTP ${res.status}`);
    return res;
  };
  manifest = (await (await get("manifest.json")).json()) as Manifest;
  const [g, r, mod] = await Promise.all([
    get(manifest.geometry.file).then((x) => x.arrayBuffer()),
    get(manifest.rotations.file).then((x) => x.arrayBuffer()),
    import("./globe/globe"),
  ]);
  rotations = new Rotations(manifest, new Int16Array(r));
  palettes = mod.PALETTES;
  const canvas = $<HTMLCanvasElement>("#globe");
  globe = new mod.Globe({ canvas, manifest, geometry: decodeGeometry(manifest, g), rotations, reducedMotion });
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
