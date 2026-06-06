"use client";

import { useEffect } from "react";
import type maplibregl from "maplibre-gl";
import type {
  Feature,
  FeatureCollection,
  Polygon,
  MultiPolygon,
} from "geojson";
import osmtogeojson from "osmtogeojson";
import { area as turfArea, booleanPointInPolygon } from "@turf/turf";
import { polygonStats } from "@/lib/geo/measurements";
import { logMeasurement, geomSummary } from "@/lib/devlog";
import { useMap } from "@/features/map/MapContext";
import { useMapUI, type SelectedBuilding } from "@/features/map/store";

const SOURCE_ID = "selected-building";
const LAYER_FILL = "selected-building-fill";
const LAYER_OUTLINE = "selected-building-outline";

type BuildingFeature = Feature<
  Polygon | MultiPolygon,
  { osm_id?: number; osm_type?: "way" | "relation"; tags: Record<string, string> }
>;

/**
 * Click anywhere on the map → query Overpass for buildings within radius →
 * convert FAITHFULLY with osmtogeojson (preserves relations, multipolygons,
 * and inner rings / courtyards) → pick the smallest footprint enclosing the
 * click → render as a glowing polygon and stash its measurements in the store.
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
        const r = await fetch(`/api/buildings?lat=${lat}&lng=${lng}&radius=80`);
        if (!r.ok) return;
        const { elements } = (await r.json()) as { elements: unknown[] };
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
        logMeasurement({
          source: "osm-select",
          name: feature.properties.tags?.["name"] ?? null,
          osm_id: feature.properties.osm_id ?? null,
          osm_type: feature.properties.osm_type ?? null,
          ...geomSummary(enriched),
          area_m2: stats.area_m2,
          perimeter_m: stats.perimeter_m,
          bbox_width_m: stats.bbox_width_m,
          bbox_length_m: stats.bbox_length_m,
          click: [lng, lat],
          geometry: enriched.geometry,
        });
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

/**
 * Convert raw Overpass elements to GeoJSON with osmtogeojson (handles ways,
 * relations, multipolygons, and inner rings), then pick the smallest footprint
 * that contains the click — so we grab the building you clicked, not a larger
 * enclosing complex, and never a neighbour.
 */
function pickBestBuilding(
  elements: unknown[],
  lng: number,
  lat: number,
): BuildingFeature | null {
  const fc = osmtogeojson({ elements } as never) as FeatureCollection;

  const polys = fc.features.filter(
    (f): f is Feature<Polygon | MultiPolygon> =>
      f.geometry != null &&
      (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"),
  );
  if (polys.length === 0) return null;

  // Prefer footprints whose interior contains the click (holes count as
  // outside, so clicking a courtyard won't select that building). Among those,
  // the smallest by true geodesic area.
  const containing = polys.filter((f) => {
    try {
      return booleanPointInPolygon([lng, lat], f);
    } catch {
      return false;
    }
  });
  const pool = containing.length > 0 ? containing : polys;
  pool.sort((a, b) => turfArea(a) - turfArea(b));

  const best = pool[0]!;
  const [osmType, osmId] = String(best.id ?? "/").split("/");

  return {
    type: "Feature",
    properties: {
      osm_id: Number(osmId) || undefined,
      osm_type: osmType === "relation" ? "relation" : "way",
      tags: (best.properties as Record<string, string> | null) ?? {},
    },
    geometry: best.geometry,
  };
}
