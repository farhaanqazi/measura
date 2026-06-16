export type ProvenanceTier = "measured" | "derived" | "estimated";

export interface ProvenancedValue {
  value: number;
  unit: "m2" | "m" | "count" | "ratio";
  tier: ProvenanceTier;
  method: string;            // stable id, e.g. "turf.area@1", "gea=footprint*floors@1"
  inputs: string[];          // ids of upstream ProvenancedValues
  token: string;             // sha256 over canonical(method, inputs, sourceFingerprint)
  uncertainty?: number;      // ± half-width of CI, same unit
  confidence?: number;       // 0..1, calibrated in Phase 0
  source: ProvenanceSource;
}

export interface ProvenanceSource {
  kind: "osm" | "user-drawn" | "satellite" | "llm" | "heuristic";
  fingerprint: SourceFingerprint;   // explicit, not a magic hash
  retrievedAt: string;              // ISO; passed in, never Date.now() in pure fns
}

/** Explicit, serializable provenance of raw inputs. */
export type SourceFingerprint =
  | { kind: "osm"; elementType: "way" | "relation"; id: number; version: number | null; timestamp: string | null }
  | { kind: "satellite"; layer: string; captureDate: string | null; gsd_m: number | null }
  | { kind: "llm"; model: string; promptVersion: string }
  | { kind: "user-drawn"; sessionId: string }
  | { kind: "heuristic"; ruleId: string };

export interface MeasurementRecord {
  footprint_m2: ProvenancedValue;
  floors?: ProvenancedValue;
  gea_m2?: ProvenancedValue;
  gia_m2?: ProvenancedValue;
  nia_m2?: ProvenancedValue;
  height_m?: ProvenancedValue;
  perimeter_m?: ProvenancedValue;
  pipelineVersion: string;         // algorithm/version stamp
  factorTableVersion: string;      // version stamp of the efficiency table
  inputFingerprint: string;        // hash of geometry + params
}
