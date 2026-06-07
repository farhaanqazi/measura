/**
 * The foundation contract for Measura.
 *
 * Core rule: **no measurement is ever a bare number.** Every value is a
 * `Provenanced<T>` carrying its source, method, confidence and assumptions, so
 * outputs are defensible/auditable for mortgage and insurance valuers.
 *
 * MEASURED facts (footprint, perimeter) live under `measured` and can be high
 * confidence. ESTIMATED facts (storeys, floor area, type) live under `estimated`
 * and default to low/medium — they must never pose as measured.
 *
 * Scope (decided 2026-06-07): single building per record. `neighbours` is
 * RESERVED so per-unit terrace splitting can be added later with no migration;
 * the adjacency engine is intentionally NOT built yet.
 *
 * Nothing here has behaviour — it is the declarative contract. The L3 assembler
 * (`assembleRecord`) is the only thing allowed to emit one of these.
 */

import type { Feature } from "geojson";

export type Confidence = "high" | "medium" | "low";

/** Generalises the old `geometry_warning` boolean into named, extensible codes. */
export type WarningCode =
  | "holes_exceed_outer"
  | "self_intersecting"
  | "implausible_area"
  | "implausible_storeys"
  | "no_height_data"
  | "whole_block_not_unit"
  | "low_zoom"
  | (string & {}); // forward-compatible without losing autocomplete on known codes

/** Where a value came from — the heart of the audit trail. */
export type Source =
  | { kind: "osm"; element: "way" | "relation"; id: number; dataset_date?: string }
  | { kind: "manual"; drawn_by?: string }
  | { kind: "derived"; from: string[] } // names of the fields it was computed from
  | { kind: "user_override"; user_id?: string }
  | { kind: "none" };

/** The atom. A value never travels without its provenance. */
export interface Provenanced<T> {
  value: T;
  unit?: string; // "m" | "m2" | "storeys"
  source: Source;
  method: string; // audit string, e.g. "turf.area outer−holes"
  confidence: Confidence;
  assumptions?: Record<string, number | string | boolean>;
  warnings?: WarningCode[];
  userOverride?: boolean;
}

/**
 * Which definition a floor-area figure claims to be. Aerial footprints trace the
 * ROOF outline, so even after deducting wall thickness this is NOT certified GIA
 * and must not be presented as matching an EPC / RICS figure.
 */
export type FloorAreaBasis =
  | "gross_external_estimate"
  | "gross_internal_estimate"
  | "unknown";

export type ProvenancedFloorArea = Provenanced<number> & { basis: FloorAreaBasis };

export type BuildingType = "detached" | "semi_detached" | "terraced" | "unknown";

/** RESERVED for future per-unit terrace splitting. Engine not built yet. */
export interface NeighbourRef {
  source: Source; // the adjacent footprint's identity
  shared_wall_m?: number; // populated only once an adjacency engine exists
}

export interface MeasurementRecord {
  // ── identity ───────────────────────────────────────────────
  id: string;
  created_at: string; // ISO 8601 — passed in, never computed in pure layers
  app_version: string;

  // ── subject ────────────────────────────────────────────────
  subject: {
    address_query?: string;
    point: [number, number]; // resolved [lng, lat], EPSG:4326
    interaction: "click" | "draw";
  };

  // ── geometry (raw, always EPSG:4326 lon/lat) ───────────────
  geometry: {
    geojson: Feature;
    source: Source;
  };

  // ── MEASURED facts (may be high confidence) ────────────────
  measured: {
    footprint_area: Provenanced<number>; // m²
    outer_perimeter: Provenanced<number>; // m
    frontage?: Provenanced<number>; // m — oriented bbox
    depth?: Provenanced<number>; // m — oriented bbox
    external_perimeter?: Provenanced<number>; // m — needs neighbours (later)
  };

  // ── ESTIMATED facts (default low/medium; never "measured") ──
  estimated: {
    storeys?: Provenanced<number>;
    floor_area?: ProvenancedFloorArea;
    building_type?: Provenanced<BuildingType>;
    roof_area?: Provenanced<number>;
  };

  // ── reserved for unit-splitting (schema-ready, no engine) ──
  neighbours?: NeighbourRef[];

  // ── audit ──────────────────────────────────────────────────
  audit: {
    imagery: { provider: string; accessed: string; zoom: number };
    data_sources: string[];
    quality: { overall_confidence: Confidence; warnings: WarningCode[] };
  };

  // ── lifecycle (immutable once confirmed; overrides version) ─
  status: "draft" | "valuer_confirmed" | "exported";
  overrides?: Record<string, unknown>;
  supersedes?: string; // previous version id → audit chain
}
