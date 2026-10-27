import { describe, expect, it } from "vitest";
import { describeMa, formatLatLon, formatMa, latitudeBand, periodAt } from "../src/data/timescale";
import { readMa } from "../src/url";

describe("timescale", () => {
  it("finds periods by age", () => {
    expect(periodAt(0).name).toBe("Quaternary");
    expect(periodAt(66).name).toBe("Paleogene");
    expect(periodAt(250).name).toBe("Triassic");
    expect(periodAt(252).name).toBe("Permian");
    expect(periodAt(750).name).toBe("Tonian");
  });
  it("formats", () => {
    expect(formatMa(0)).toBe("Today");
    expect(formatMa(249.6)).toBe("250 Ma");
    expect(describeMa(300)).toBe("300 million years ago, Carboniferous period");
    expect(formatLatLon(-42.06, 98.12)).toBe("42.1°S 98.1°E");
    expect(latitudeBand(-42)).toBe("Mid-latitudes");
    expect(latitudeBand(1.3)).toBe("Tropics");
  });
  it("reads ?ma= safely", () => {
    expect(readMa("?ma=250")).toBe(250);
    expect(readMa("?ma=9999")).toBe(750);
    expect(readMa("?ma=abc")).toBeNull();
    expect(readMa("")).toBeNull();
  });
});
