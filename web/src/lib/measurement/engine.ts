/**
 * Pure L1 geometry engine — the provenance-aware successor to the raw helpers in
 * `lib/geo/measurements.ts`. It is NEW and additive: nothing imports it yet.
 * `assembleRecord()` (step 4) will be its first and only consumer, so the cutover
 * happens once, behind the benchmark gate — not by rewriting the old module's
 * contract under its existing callers.
 *
 * It reproduces the current area/perimeter numbers (same formulas) so the
 * characterization test passes, and ADDS a validity guard: malformed geometry
 * yields a warning + low confidence, never a confident number.
 */

import { area, length, kinks } from "@turf/turf";
import type { Feature, Polygon, MultiPolygon, Position } from "geojson";
import type { Confidence, Provenanced, Source, WarningCode } from "./record";

const M_PER_KM = 1000;
/** A single building footprint above ~1 km² is implausible — flag, don't trust. */
const IMPLAUSIBLE_AREA_M2 = 1_000_000;

function polygonsOf(feature: Feature<Polygon | MultiPolygon>): Position[][][] {
  return feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
}

function ringAreaM2(ring: Position[]): number {
  if (ring.length < 4) return 0;
  return area({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } });
}

function ringLengthM(ring: Position[]): number {
  if (ring.length < 2) return 0;
  return (
    length(
      { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ring } },
      { units: "kilometers" },
    ) * M_PER_KM
  );
}

export interface FootprintFacts {
  footprint_area: Provenanced<number>;
  outer_perimeter: Provenanced<number>;
  /** Aggregate of every warning raised, for the record's quality block. */
  warnings: WarningCode[];
  /** Overall geometric confidence — high only when nothing tripped the guard. */
  confidence: Confidence;
}

/**
 * Compute the measured footprint facts with a validity guard.
 *
 * Guard conditions (each → warning + confidence downgrade, never a confident number):
 *  - self-intersecting ring (turf.kinks)
 *  - inner rings whose area ≥ outer (impossible → fall back to gross outer)
 *  - non-positive or implausibly large area
 */
export function computeFootprint(
  feature: Feature<Polygon | MultiPolygon>,
  source: Source,
): FootprintFacts {
  const warnings: WarningCode[] = [];

  // 1. self-intersection
  let selfIntersecting = false;
  try {
    selfIntersecting = kinks(feature).features.length > 0;
  } catch {
    /* kinks can throw on degenerate input — treat as non-fatal */
  }
  if (selfIntersecting) warnings.push("self_intersecting");

  // 2. area (outer − holes) and perimeter (outer rings only)
  let outerArea = 0;
  let holeArea = 0;
  let perimeter = 0;
  for (const poly of polygonsOf(feature)) {
    const [outer, ...holes] = poly;
    if (outer) {
      outerArea += ringAreaM2(outer);
      perimeter += ringLengthM(outer);
    }
    for (const hole of holes) holeArea += ringAreaM2(hole);
  }
  const net = outerArea - holeArea;
  const holesExceedOuter = net <= 0;
  if (holesExceedOuter) warnings.push("holes_exceed_outer");
  const areaM2 = holesExceedOuter ? outerArea : net;

  // 3. plausibility
  if (areaM2 <= 0 || areaM2 > IMPLAUSIBLE_AREA_M2) warnings.push("implausible_area");

  const areaClean = !holesExceedOuter && !selfIntersecting && areaM2 > 0 && areaM2 <= IMPLAUSIBLE_AREA_M2;
  const confidence: Confidence = areaClean ? "high" : "low";

  return {
    footprint_area: {
      value: areaM2,
      unit: "m2",
      source,
      method: holesExceedOuter
        ? "turf.area gross outer (holes≥outer fallback)"
        : "turf.area outer−holes",
      confidence,
      warnings: warnings.length ? [...warnings] : undefined,
    },
    outer_perimeter: {
      value: perimeter,
      unit: "m",
      source,
      method: "turf.length outer rings only",
      confidence: selfIntersecting ? "low" : "high",
      warnings: selfIntersecting ? ["self_intersecting"] : undefined,
    },
    warnings,
    confidence,
  };
}
