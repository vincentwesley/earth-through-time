// Geologic periods (ICS International Chronostratigraphic Chart v2024/12: base ages
// and the chart's standard colours), the jump points, and display formatting.

export interface Period {
  name: string;
  /** Age of the period's base, in Ma. */
  start: number;
  color: string;
}

/** Youngest first. Bases from ICS v2024/12 (Ediacaran and Cryogenian are approximate, "~"). */
export const PERIODS: readonly Period[] = [
  { name: "Quaternary", start: 2.58, color: "#f9f97f" },
  { name: "Neogene", start: 23.04, color: "#ffe619" },
  { name: "Paleogene", start: 66.0, color: "#fd9a52" },
  { name: "Cretaceous", start: 143.1, color: "#7fc64e" },
  { name: "Jurassic", start: 201.4, color: "#34b2c9" },
  { name: "Triassic", start: 251.902, color: "#812b92" },
  { name: "Permian", start: 298.9, color: "#f04028" },
  { name: "Carboniferous", start: 358.86, color: "#67a599" },
  { name: "Devonian", start: 419.62, color: "#cb8c37" },
  { name: "Silurian", start: 443.1, color: "#b3e1b6" },
  { name: "Ordovician", start: 486.85, color: "#009270" },
  { name: "Cambrian", start: 538.8, color: "#7fa056" },
  { name: "Ediacaran", start: 635, color: "#fed96a" },
  { name: "Cryogenian", start: 720, color: "#fecc5c" },
  { name: "Tonian", start: 1000, color: "#febf4e" },
];

/** Jump points shown as chips under the slider, oldest first. */
export const MOMENTS: readonly { ma: number; label: string }[] = [
  { ma: 750, label: "Rodinia breaking up" },
  { ma: 520, label: "Gondwana assembled" },
  { ma: 250, label: "Pangaea" },
  { ma: 180, label: "Pangaea splits" },
  { ma: 66, label: "End of dinosaurs" },
  { ma: 0, label: "Today" },
];

/** The period containing `ma`; a boundary age belongs to the younger period (66 Ma is Paleogene). */
export function periodAt(ma: number): Period {
  return PERIODS.find((p) => ma <= p.start) ?? PERIODS[PERIODS.length - 1];
}

export function formatMa(ma: number): string {
  const r = Math.round(ma);
  return r <= 0 ? "Today" : `${r} Ma`;
}

export function describeMa(ma: number): string {
  const r = Math.round(ma);
  return r <= 0 ? "Today" : `${r} million years ago, ${periodAt(ma).name} period`;
}

export function formatLatLon(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(1)}°${lat < 0 ? "S" : "N"} ${Math.abs(lon).toFixed(1)}°${lon < 0 ? "W" : "E"}`;
}

/** Tropics and polar bands use the same circles as the globe's guides (23.44°, 66.56°). */
export function latitudeBand(lat: number): string {
  const a = Math.abs(lat);
  if (a < 23.44) return "Tropics";
  if (a < 35) return "Subtropics";
  if (a < 66.56) return "Mid-latitudes";
  return "Polar regions";
}
