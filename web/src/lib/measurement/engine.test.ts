import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { computeFootprint } from "./engine";
import type { Source } from "./record";
import { polygonStats } from "@/lib/geo/measurements";

const SRC: Source = { kind: "none" };

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "buildings.json",
);
const buildings = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<
  string,
  Feature<Polygon | MultiPolygon>
>;

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

// ── 1. CHARACTERIZATION ──────────────────────────────────────────────
// The new engine must reproduce the CURRENT measurements.ts numbers, so the
// step-2 refactor can't silently drift. (Separate from value-vs-truth below.)
describe("characterization: engine reproduces current measurements.ts", () => {
  for (const [name, feature] of Object.entries(buildings)) {
    it(`${name} area & perimeter match`, () => {
      const old = polygonStats(feature);
      const next = computeFootprint(feature, SRC);
      expect(rel(next.footprint_area.value, old.area_m2)).toBeLessThan(0.001);
      expect(rel(next.outer_perimeter.value, old.perimeter_m)).toBeLessThan(0.001);
    });
  }
});

// ── 1b. FROZEN BASELINE ──────────────────────────────────────────────
// Snapshot the CURRENT measurements.ts outputs over the fixtures and commit
// them. This freezes today's behaviour as a baseline, so a future change to
// EITHER measurements.ts or the engine that shifts a number gets caught — the
// case a live equivalence check alone would miss.
describe("frozen baseline of current measurements.ts", () => {
  for (const [name, feature] of Object.entries(buildings)) {
    it(`${name} baseline`, () => {
      const s = polygonStats(feature);
      expect({
        area_m2: Math.round(s.area_m2),
        perimeter_m: Math.round(s.perimeter_m),
        geometry_warning: s.geometry_warning,
      }).toMatchSnapshot();
    });
  }
});

// ── 2. TOLERANCE vs KNOWN TRUTH ──────────────────────────────────────
describe("tolerance vs known official footprints", () => {
  it("Buckingham Palace footprint ≈ 12,960 m² (within 25%)", () => {
    const a = computeFootprint(buildings.buckingham!, SRC).footprint_area.value;
    expect(rel(a, 12_960)).toBeLessThan(0.25);
  });

  it("a simple building (museum) is clean: high confidence, no warnings, positive", () => {
    const f = computeFootprint(buildings.museum!, SRC);
    expect(f.footprint_area.value).toBeGreaterThan(0);
    expect(f.warnings).toHaveLength(0);
    expect(f.footprint_area.confidence).toBe("high");
  });

  it("malformed real building (New Parliament) is flagged, never negative", () => {
    const f = computeFootprint(buildings.newParliament!, SRC);
    expect(f.footprint_area.value).toBeGreaterThan(0); // not the old −260
    expect(f.warnings).toContain("holes_exceed_outer");
    expect(f.footprint_area.confidence).toBe("low");
  });
});

// ── 3. NEGATIVE FIXTURES: the validity guard must FIRE ────────────────
// Hand-crafted bad geometry — the part that rots silently because nothing
// exercises it in normal use.
const poly = (coords: number[][][]): Feature<Polygon> => ({
  type: "Feature",
  properties: {},
  geometry: { type: "Polygon", coordinates: coords },
});

describe("validity guard fires on bad geometry", () => {
  it("self-intersecting ring → warning + low confidence", () => {
    const bowtie = poly([
      [
        [0, 0],
        [0.001, 0.001],
        [0.001, 0],
        [0, 0.001],
        [0, 0],
      ],
    ]);
    const f = computeFootprint(bowtie, SRC);
    expect(f.warnings).toContain("self_intersecting");
    expect(f.footprint_area.confidence).toBe("low");
  });

  it("inner ring larger than outer → fallback to positive, flagged, low confidence", () => {
    const holesBig = poly([
      [
        [0, 0],
        [0.001, 0],
        [0.001, 0.001],
        [0, 0.001],
        [0, 0],
      ], // small outer
      [
        [-0.001, -0.001],
        [0.002, -0.001],
        [0.002, 0.002],
        [-0.001, 0.002],
        [-0.001, -0.001],
      ], // bigger "hole"
    ]);
    const f = computeFootprint(holesBig, SRC);
    expect(f.warnings).toContain("holes_exceed_outer");
    expect(f.footprint_area.value).toBeGreaterThan(0); // never negative
    expect(f.footprint_area.confidence).toBe("low");
  });

  it("implausibly large area → warning + low confidence", () => {
    const huge = poly([
      [
        [0, 0],
        [0.3, 0],
        [0.3, 0.3],
        [0, 0.3],
        [0, 0],
      ],
    ]);
    const f = computeFootprint(huge, SRC);
    expect(f.warnings).toContain("implausible_area");
    expect(f.footprint_area.confidence).toBe("low");
  });
});
