"use client";

import { useEffect } from "react";
import type maplibregl from "maplibre-gl";
import type {
  Feature,
  FeatureCollection,
  Polygon,
  MultiPolygon,
} from "geojson";
import { polygonStats } from "@/lib/geo/measurements";
import { useMap } from "@/features/map/MapContext";
import { useMapUI, type SelectedBuilding } from "@/features/map/store";

const SOURCE_ID = "selected-building";
const LAYER_FILL = "selected-building-fill";
const LAYER_OUTLINE = "selected-building-outline";

interface OverpassNode {
  lat: number;
  lon: number;
}
interface OverpassWay {
  type: "way";
  id: number;
  geometry?: OverpassNode[];
  tags?: Record<string, string>;
}
interface OverpassRelation {
  type: "relation";
  id: number;
  members?: { type: string; ref: number; role: string; geometry?: OverpassNode[] }[];
  tags?: Record<string, string>;
}
type OverpassElement = OverpassWay | OverpassRelation;

/**
 * Click anywhere on the map → query Overpass for buildings within 60m → pick
 * the smallest enclosing footprint → render as a glowing polygon and stash
 * its computed measurements in the global store.
 */
export function useBuildingDetection() {
  const { map } = useMap();
  const setSelected = useMapUI((s) => s.setSelected);
  const setDetecting = useMapUI((s) => s.setDetecting);
  const setDetailOpen = useMapUI((s) => s.setDetailOpen);
  const tool = useMapUI((s) => s.tool);

  // Register the source/layers on map load (once).
  useEffect(() => {
    if (!map) return;
    if (map.getSource(SOURCE_ID)) return;

    const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
    map.addSource(SOURCE_ID, { type: "geojson", data: empty });

    map.addLayer({
      id: LAYER_FILL,
      source: SOURCE_ID,
      type: "fill",
      paint: {
        "fill-color": "#22d3ee",
        "fill-opacity": 0.18,
      },
    });
    map.addLayer({
      id: LAYER_OUTLINE,
      source: SOURCE_ID,
      type: "line",
      paint: {
        "line-color": "#22d3ee",
        "line-width": 2.5,
        "line-blur": 0.5,
      },
    });
  }, [map]);

  // Click handler — only active in select mode.
  useEffect(() => {
    if (!map) return;
    if (tool !== "select") return;

    let cancelled = false;
    const handler = async (e: maplibregl.MapMouseEvent) => {
      if (cancelled) return;
      setDetecting(true);
      try {
        const { lng, lat } = e.lngLat;
        const r = await fetch(`/api/buildings?lat=${lat}&lng=${lng}&radius=60`);
        if (!r.ok) return;
        const { elements } = (await r.json()) as { elements: OverpassElement[] };
        const feature = pickBestBuilding(elements, lng, lat);
        if (!feature) {
          setSelected(null);
          (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData({
            type: "FeatureCollection",
            features: [],
          });
          return;
        }
        const stats = polygonStats(feature);
        const enriched: SelectedBuilding = {
          ...feature,
          properties: {
            ...feature.properties,
            ...stats,
          },
        };
        setSelected(enriched);
        setDetailOpen(true);
        (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: [enriched],
        });
      } finally {
        if (!cancelled) setDetecting(false);
      }
    };

    map.on("click", handler);
    map.getCanvas().style.cursor = "crosshair";
    return () => {
      cancelled = true;
      map.off("click", handler);
      map.getCanvas().style.cursor = "";
    };
  }, [map, tool, setSelected, setDetecting, setDetailOpen]);
}

/** Convert Overpass elements to GeoJSON Polygons; pick the smallest one
 * containing the click (so we don't grab the building NEXT door). */
function pickBestBuilding(
  elements: OverpassElement[],
  lng: number,
  lat: number,
): Feature<Polygon | MultiPolygon, Record<string, unknown>> | null {
  const polygons: Feature<Polygon, Record<string, unknown>>[] = [];

  for (const el of elements) {
    if (el.type === "way" && el.geometry && el.geometry.length >= 3) {
      const ring = el.geometry.map((n) => [n.lon, n.lat] as [number, number]);
      // Close the ring if needed
      const first = ring[0]!;
      const last = ring[ring.length - 1]!;
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
      polygons.push({
        type: "Feature",
        properties: { osm_id: el.id, osm_type: "way", tags: el.tags ?? {} },
        geometry: { type: "Polygon", coordinates: [ring] },
      });
    }
    // Note: relation/multipolygon support would parse `members` outers/inners;
    // skipped for v1 since `way` covers the vast majority of buildings.
  }

  if (polygons.length === 0) return null;

  // Prefer polygons that strictly contain the click point; among those, smallest.
  const containing = polygons.filter((p) => isPointInRing([lng, lat], p.geometry.coordinates[0]!));
  const candidates = containing.length > 0 ? containing : polygons;
  candidates.sort((a, b) => bboxArea(a) - bboxArea(b));
  return candidates[0]!;
}

function bboxArea(f: Feature<Polygon, Record<string, unknown>>) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of f.geometry.coordinates[0]!) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return (maxX - minX) * (maxY - minY);
}

function isPointInRing([px, py]: [number, number], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersect =
      yi! > py !== yj! > py &&
      px < ((xj! - xi!) * (py - yi!)) / (yj! - yi!) + xi!;
    if (intersect) inside = !inside;
  }
  return inside;
}
