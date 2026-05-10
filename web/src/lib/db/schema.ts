import type { Feature, Geometry } from "geojson";

/**
 * Local Dexie schema mirrors the Supabase shape so the SyncEngine can pump
 * rows through with minimal transformation. UUID v4 is generated on insert.
 */

export type SyncStatus = "pending" | "synced" | "error";

export interface Project {
  id: string;
  user_id: string | null;
  name: string;
  use_case: "real_estate" | "construction" | "insurance" | "gis" | "general";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;
}

export type MeasurementKind =
  | "building" // auto-detected OSM building footprint
  | "polygon" // user-drawn area
  | "linestring" // user-drawn distance
  | "point" // user-placed marker
  | "rectangle"
  | "distance" // pairwise distance reading
  | "setback"; // building → boundary distance

export interface Measurement {
  id: string;
  project_id: string;
  kind: MeasurementKind;
  /** GeoJSON feature with computed properties (area, perimeter, length, bbox, etc.) */
  feature: Feature<Geometry, MeasurementProperties>;
  label: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;
}

export interface MeasurementProperties {
  /** sq meters */
  area_m2?: number;
  /** meters */
  perimeter_m?: number;
  /** meters */
  length_m?: number;
  /** [minLng, minLat, maxLng, maxLat] */
  bbox?: [number, number, number, number];
  /** approximate width × length from bbox in meters */
  bbox_width_m?: number;
  bbox_length_m?: number;
  centroid?: [number, number];
  /** Free-form metadata (OSM tags, custom fields, etc.) */
  meta?: Record<string, unknown>;
}

/** Outbox entry — a write that hasn't been pushed to Supabase yet. */
export interface OutboxEntry {
  id: string;
  table: "projects" | "measurements";
  op: "insert" | "update" | "delete";
  row_id: string;
  payload: unknown;
  attempts: number;
  last_error: string | null;
  created_at: string;
}
