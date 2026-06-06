"use client";

import type { Feature, Geometry } from "geojson";

/**
 * Dev-only measurement logging. Every building selection / manual trace gets
 * POSTed to /api/devlog, which appends it to `measurement-log.jsonl` at the
 * repo root. Lets us inspect exactly which corners/edges + source produced a
 * measurement, alongside screenshots. No-ops in production.
 */
export function logMeasurement(entry: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  try {
    void fetch("/api/devlog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
      keepalive: true,
    });
  } catch {
    /* dev-only; never let logging break the app */
  }
}

/** Summarize a geometry: ring counts (holes = courtyards) and vertex count. */
export function geomSummary(feature: Feature<Geometry>) {
  const g = feature.geometry;
  let outerRings = 0;
  let holeRings = 0;
  let vertices = 0;

  if (g.type === "Polygon") {
    outerRings = g.coordinates.length > 0 ? 1 : 0;
    holeRings = Math.max(0, g.coordinates.length - 1);
    vertices = g.coordinates.reduce((a, r) => a + r.length, 0);
  } else if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates) {
      outerRings += 1;
      holeRings += Math.max(0, poly.length - 1);
      vertices += poly.reduce((a, r) => a + r.length, 0);
    }
  } else if (g.type === "LineString") {
    vertices = g.coordinates.length;
  }

  return { geometryType: g.type, outerRings, holeRings, vertices };
}
