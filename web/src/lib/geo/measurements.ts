import {
  area,
  length,
  bbox,
  centroid,
  distance,
  bearing,
  pointToLineDistance,
  nearestPointOnLine,
} from "@turf/turf";
import type {
  Feature,
  Geometry,
  Polygon,
  MultiPolygon,
  LineString,
  Point,
  Position,
} from "geojson";
import type { ProvenancedValue, ProvenanceSource } from "../provenance/types";
import { generateProvenanceToken } from "../provenance/token";

/**
 * Pure functions that compute measurement properties from GeoJSON features.
 * All distance values are in meters; all area values are in square meters.
 *
 * These functions are intentionally framework-agnostic so they can be used
 * server-side (e.g. in Supabase edge functions) just as easily as client-side.
 */

const M_PER_KM = 1000;

/** Every polygon's ring-set, whether the feature is a Polygon or MultiPolygon. */
function polygonsOf(feature: Feature<Polygon | MultiPolygon>): Position[][][] {
  return feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
}

/** Geodesic area (m²) of a single ring; 0 for degenerate rings. */
function ringAreaM2(ring: Position[]): number {
  if (ring.length < 4) return 0;
  return area({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } });
}

/** Geodesic length (m) of a single ring. */
function ringLengthM(ring: Position[]): number {
  if (ring.length < 2) return 0;
  return (
    length(
      { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ring } },
      { units: "kilometers" },
    ) * M_PER_KM
  );
}

export function polygonStats(feature: Feature<Polygon | MultiPolygon>) {
  // Perimeter from OUTER rings only — Turf's length() would otherwise add every
  // courtyard wall, massively inflating it. Area = outer minus holes; but if the
  // converted geometry is malformed (holes ≥ outer → an impossible negative
  // area), fall back to the gross outer area and flag it instead of nonsense.
  let outerArea = 0;
  let holeArea = 0;
  let perimeter_m = 0;
  for (const poly of polygonsOf(feature)) {
    const [outer, ...holes] = poly;
    if (outer) {
      outerArea += ringAreaM2(outer);
      perimeter_m += ringLengthM(outer);
    }
    for (const hole of holes) holeArea += ringAreaM2(hole);
  }
  const net = outerArea - holeArea;
  const geometry_warning = net <= 0;
  const area_m2 = geometry_warning ? outerArea : net;

  const [minLng, minLat, maxLng, maxLat] = bbox(feature);
  const c = centroid(feature).geometry.coordinates as [number, number];

  // Approximate orthogonal width × length from bbox diagonal points.
  const widthFt = distance(
    { type: "Feature", geometry: { type: "Point", coordinates: [minLng, minLat] }, properties: {} },
    { type: "Feature", geometry: { type: "Point", coordinates: [maxLng, minLat] }, properties: {} },
    { units: "kilometers" },
  );
  const lengthFt = distance(
    { type: "Feature", geometry: { type: "Point", coordinates: [minLng, minLat] }, properties: {} },
    { type: "Feature", geometry: { type: "Point", coordinates: [minLng, maxLat] }, properties: {} },
    { units: "kilometers" },
  );

  return {
    area_m2,
    perimeter_m,
    geometry_warning,
    bbox: [minLng, minLat, maxLng, maxLat] as [number, number, number, number],
    bbox_width_m: widthFt * M_PER_KM,
    bbox_length_m: lengthFt * M_PER_KM,
    centroid: c,
  };
}

export function lineStats(feature: Feature<LineString>) {
  const length_m = length(feature, { units: "kilometers" }) * M_PER_KM;
  const coords = feature.geometry.coordinates;
  const start = coords[0]!;
  const end = coords[coords.length - 1]!;
  const bearing_deg = bearing(start, end);
  return { length_m, bearing_deg, start, end };
}

export function pointToPoint(a: Position, b: Position) {
  return distance(a, b, { units: "kilometers" }) * M_PER_KM;
}

export function pointToPolygonNearest(
  point: Feature<Point>,
  polygon: Feature<Polygon | MultiPolygon>,
) {
  // Convert polygon ring(s) to lines and find the closest one.
  const rings: Position[][] =
    polygon.geometry.type === "Polygon"
      ? polygon.geometry.coordinates
      : polygon.geometry.coordinates.flat();

  let best: { d_m: number; nearest: Position } | null = null;
  for (const ring of rings) {
    const line: Feature<LineString> = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: ring },
    };
    const d_km = pointToLineDistance(point, line, { units: "kilometers" });
    const d_m = d_km * M_PER_KM;
    if (!best || d_m < best.d_m) {
      const np = nearestPointOnLine(line, point, { units: "kilometers" });
      best = { d_m, nearest: np.geometry.coordinates as Position };
    }
  }
  return best ?? { d_m: Infinity, nearest: point.geometry.coordinates };
}

export function formatLength(meters: number, unit: "metric" | "imperial" = "metric") {
  if (unit === "imperial") {
    const ft = meters * 3.28084;
    return ft >= 5280
      ? `${(ft / 5280).toFixed(2)} mi`
      : `${ft.toFixed(1)} ft`;
  }
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(1)} m`;
}

export function formatArea(squareMeters: number, unit: "metric" | "imperial" = "metric") {
  if (unit === "imperial") {
    const sqFt = squareMeters * 10.7639;
    return sqFt >= 43560
      ? `${(sqFt / 43560).toFixed(3)} ac`
      : `${sqFt.toFixed(0)} ft²`;
  }
  return squareMeters >= 10_000
    ? `${(squareMeters / 10_000).toFixed(3)} ha`
    : `${squareMeters.toFixed(1)} m²`;
}

export type GeometryWithStats = Feature<Geometry> & {
  properties: ReturnType<typeof polygonStats> | ReturnType<typeof lineStats>;
};

export async function toMeasurementRecord(
  feature: Feature<Polygon | MultiPolygon>,
  source: ProvenanceSource
): Promise<{ footprint_m2: ProvenancedValue; perimeter_m: ProvenancedValue }> {
  const stats = polygonStats(feature);
  
  // Method identifier (can be versioned later)
  const methodArea = "turf.area@1";
  const methodPerimeter = "turf.length@1";

  const areaToken = await generateProvenanceToken(methodArea, [], source.fingerprint);
  const perimToken = await generateProvenanceToken(methodPerimeter, [], source.fingerprint);

  return {
    footprint_m2: {
      value: stats.area_m2,
      unit: "m2",
      tier: "measured",
      method: methodArea,
      inputs: [],
      token: areaToken,
      confidence: stats.geometry_warning ? 0.5 : 0.9, 
      source,
    },
    perimeter_m: {
      value: stats.perimeter_m,
      unit: "m",
      tier: "measured",
      method: methodPerimeter,
      inputs: [],
      token: perimToken,
      confidence: stats.geometry_warning ? 0.5 : 0.9,
      source,
    }
  };
}
