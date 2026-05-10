import type { StyleSpecification } from "maplibre-gl";

/**
 * Free, hosted map styles. We compose two sources:
 *
 *   1. OSM raster tiles  — base streets layer
 *   2. Esri World Imagery — free satellite layer (non-commercial OK)
 *
 * Switching layers is as simple as toggling the `visibility` of the
 * `osm` and `esri` layers — both stay on the map for instant cross-fade.
 *
 * If Esri's terms ever change, swap to MapTiler (with API key) or
 * NASA GIBS (true free) without touching the rest of the app.
 */

const ATTRIBUTION_OSM =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
const ATTRIBUTION_ESRI =
  'Tiles © <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

export const MEASURA_STYLE: StyleSpecification = {
  version: 8,
  glyphs:
    "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: ATTRIBUTION_OSM,
      maxzoom: 19,
    },
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: ATTRIBUTION_ESRI,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#0a0d12" },
    },
    {
      id: "esri",
      type: "raster",
      source: "esri",
      layout: { visibility: "visible" },
      paint: { "raster-saturation": -0.05, "raster-contrast": 0.05 },
    },
    {
      id: "osm",
      type: "raster",
      source: "osm",
      layout: { visibility: "none" },
    },
  ],
};

export type BaseLayer = "satellite" | "streets";

export function applyBaseLayer(
  map: maplibregl.Map,
  layer: BaseLayer,
) {
  map.setLayoutProperty("esri", "visibility", layer === "satellite" ? "visible" : "none");
  map.setLayoutProperty("osm", "visibility", layer === "streets" ? "visible" : "none");
}
