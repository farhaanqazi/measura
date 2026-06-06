"use client";

import { create } from "zustand";
import type { Feature, Polygon, MultiPolygon, LineString, Point } from "geojson";
import type { BaseLayer } from "./styles";

export type ToolMode = "select" | "ruler" | "polygon" | "rectangle";

export type SelectedBuilding = Feature<Polygon | MultiPolygon, {
  osm_id?: number;
  osm_type?: "way" | "relation";
  tags?: Record<string, string | undefined>;
  area_m2: number;
  perimeter_m: number;
  bbox: [number, number, number, number];
  bbox_width_m: number;
  bbox_length_m: number;
  centroid: [number, number];
}>;

export type DrawnFeature = Feature<Polygon | LineString | Point, {
  area_m2?: number;
  perimeter_m?: number;
  length_m?: number;
  tags?: Record<string, string | undefined>;
  centroid?: [number, number];
  osm_id?: number;
  osm_type?: "way" | "relation";
  bbox_width_m?: number;
  bbox_length_m?: number;
}>;

interface MapUIState {
  baseLayer: BaseLayer;
  setBaseLayer: (l: BaseLayer) => void;

  tool: ToolMode;
  setTool: (t: ToolMode) => void;

  unit: "metric" | "imperial";
  setUnit: (u: "metric" | "imperial") => void;

  selected: SelectedBuilding | null;
  setSelected: (b: SelectedBuilding | null) => void;

  drawnFeature: DrawnFeature | null;
  setDrawnFeature: (f: DrawnFeature | null) => void;

  /** Loading flag for async building lookups. */
  detecting: boolean;
  setDetecting: (v: boolean) => void;

  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  toggleSearch: () => void;

  detailOpen: boolean;
  setDetailOpen: (v: boolean) => void;
}

export const useMapUI = create<MapUIState>((set) => ({
  baseLayer: "satellite",
  setBaseLayer: (l) => set({ baseLayer: l }),

  tool: "select",
  setTool: (t) => set({ tool: t }),

  unit: "metric",
  setUnit: (u) => set({ unit: u }),

  selected: null,
  setSelected: (b) => set({ selected: b }),

  drawnFeature: null,
  setDrawnFeature: (f) => set({ drawnFeature: f }),

  detecting: false,
  setDetecting: (v) => set({ detecting: v }),

  searchOpen: false,
  setSearchOpen: (v) => set({ searchOpen: v }),
  toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),

  detailOpen: false,
  setDetailOpen: (v) => set({ detailOpen: v }),
}));
