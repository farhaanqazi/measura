// ─────────────────────────────────────────────────────────────────────────────
// Efficiency factors — gross→internal→usable area ratios.
//
// v1 (flat): one factor per building TYPE. Kept, frozen, never edited.
// v2 (stratified): factor per TYPE × ERA × MARKET, each carrying its own
//     published source + confidence. v2 is the current DEFAULT methodology.
//
// IMMUTABILITY RULE: once a version id is published it is never edited. A change
// to any factor = a NEW version id. Past MeasurementRecords keep their original
// `factorTableVersion` and are read against the table of that version — they are
// never retroactively recomputed.
// ─────────────────────────────────────────────────────────────────────────────

/** Legacy flat methodology — still the default of `getEfficiencyFactors()`. */
export const LEGACY_FLAT_FACTOR_TABLE_VERSION = "efficiency_v1_2026Q2";

/** Current DEFAULT methodology = stratified v2 (used by `resolveEfficiencyFactors()`). */
export const CURRENT_FACTOR_TABLE_VERSION = "efficiency_v2_2026Q2";

export type BuildingType = "office" | "residential" | "retail" | "industrial" | "unknown";

// ── v1 (flat) ────────────────────────────────────────────────────────────────

interface EfficiencyFactor {
  gia_from_gea: number;
  nia_from_gia: number;
}

/**
 * Immutable, versioned table of FLAT efficiency factors (v1).
 * Once published, a version is never edited.
 */
export const EFFICIENCY_TABLES: Record<string, Record<BuildingType, EfficiencyFactor>> = {
  efficiency_v1_2026Q2: {
    office: { gia_from_gea: 0.95, nia_from_gia: 0.80 },
    residential: { gia_from_gea: 0.95, nia_from_gia: 0.85 },
    retail: { gia_from_gea: 0.95, nia_from_gia: 0.90 },
    industrial: { gia_from_gea: 0.98, nia_from_gia: 0.95 },
    unknown: { gia_from_gea: 1.0, nia_from_gia: 1.0 }, // Fallback, heavily penalized in confidence
  },
};

/**
 * Flat (v1) lookup. Preserved unchanged for backward compatibility and for
 * reading historical records stamped with the v1 version.
 */
export function getEfficiencyFactors(
  buildingType: BuildingType,
  version: string = LEGACY_FLAT_FACTOR_TABLE_VERSION
): EfficiencyFactor {
  const table = EFFICIENCY_TABLES[version];
  if (!table) throw new Error(`Unknown factor table version: ${version}`);
  return table[buildingType] || table["unknown"];
}

// ── v2 (stratified) ──────────────────────────────────────────────────────────

/** Market = region + the measurement standard whose ratios we seed from. */
export type Market = "UK_RICS" | "US_ANSI" | "IN_RERA";

/** Construction-era band. Boundaries are inclusive-lower (see `eraFromYear`). */
export type Era = "pre1945" | "1945_1980" | "post1980" | "unknown";

export interface StratifiedFactor {
  gia_from_gea: number;
  nia_from_gia: number;
  /** Citation for the seed values, e.g. "RICS Code of Measuring Practice (6th ed.)". */
  source: string;
  /** 0..1 calibrated confidence in this stratum (≤0.7 until Phase-0 calibration). */
  confidence: number;
}

const RICS = "RICS Code of Measuring Practice (6th ed.)";
const UNCALIBRATED = "uncalibrated:awaiting-phase0";

/** A whole building-type block keyed by populated era (industrial/unknown are era-flat). */
type EraBlock = Record<Exclude<Era, "unknown">, StratifiedFactor>;

const flatEra = (f: Omit<StratifiedFactor, never>): EraBlock => ({
  pre1945: f,
  "1945_1980": f,
  post1980: f,
});

/** UK / RICS — the first fully-calibrated market. Seeded from RICS CoMP; confidence ≤0.7. */
const UK_RICS_TABLE: Record<BuildingType, EraBlock> = {
  residential: {
    pre1945: { gia_from_gea: 0.93, nia_from_gia: 0.80, source: RICS, confidence: 0.65 },
    "1945_1980": { gia_from_gea: 0.95, nia_from_gia: 0.85, source: RICS, confidence: 0.7 },
    post1980: { gia_from_gea: 0.95, nia_from_gia: 0.88, source: RICS, confidence: 0.7 },
  },
  office: {
    pre1945: { gia_from_gea: 0.93, nia_from_gia: 0.78, source: RICS, confidence: 0.65 },
    "1945_1980": { gia_from_gea: 0.95, nia_from_gia: 0.80, source: RICS, confidence: 0.7 },
    post1980: { gia_from_gea: 0.95, nia_from_gia: 0.82, source: RICS, confidence: 0.7 },
  },
  retail: {
    pre1945: { gia_from_gea: 0.94, nia_from_gia: 0.88, source: RICS, confidence: 0.6 },
    "1945_1980": { gia_from_gea: 0.95, nia_from_gia: 0.90, source: RICS, confidence: 0.65 },
    post1980: { gia_from_gea: 0.95, nia_from_gia: 0.90, source: RICS, confidence: 0.65 },
  },
  industrial: flatEra({ gia_from_gea: 0.98, nia_from_gia: 0.95, source: RICS, confidence: 0.7 }),
  unknown: flatEra({ gia_from_gea: 1.0, nia_from_gia: 1.0, source: "fallback:no-type", confidence: 0.3 }),
};

/**
 * Build a registered-but-uncalibrated market by mirroring UK structure and values
 * while honestly stamping every cell as not-yet-trusted. These DEGRADE, never throw,
 * until replaced by a sourced, calibrated table published under a new version id.
 */
function placeholderMarket(base: Record<BuildingType, EraBlock>): Record<BuildingType, EraBlock> {
  const out = {} as Record<BuildingType, EraBlock>;
  for (const type of Object.keys(base) as BuildingType[]) {
    const block = base[type];
    out[type] = {
      pre1945: { ...block.pre1945, source: UNCALIBRATED, confidence: 0.3 },
      "1945_1980": { ...block["1945_1980"], source: UNCALIBRATED, confidence: 0.3 },
      post1980: { ...block.post1980, source: UNCALIBRATED, confidence: 0.3 },
    };
  }
  return out;
}

/**
 * Immutable, versioned table of STRATIFIED efficiency factors (v2).
 * Shape: version → market → building type → era → factor.
 */
export const STRATIFIED_EFFICIENCY_TABLES: Record<
  string,
  Record<Market, Record<BuildingType, EraBlock>>
> = {
  efficiency_v2_2026Q2: {
    UK_RICS: UK_RICS_TABLE,
    US_ANSI: placeholderMarket(UK_RICS_TABLE), // awaiting ANSI Z765 calibration
    IN_RERA: placeholderMarket(UK_RICS_TABLE), // awaiting RERA carpet calibration
  },
};

const DEFAULT_MARKET: Market = "UK_RICS";
/** Confidence multiplier applied when era is unknown and we fall back to post-1980. */
const ERA_FALLBACK_PENALTY = 0.8;

/**
 * Bucket a construction year into an era band.
 * Boundaries are inclusive-lower: 1945→`1945_1980`, 1980→`1945_1980`, 1981→`post1980`.
 * Missing or implausible years → `unknown` (never guessed).
 */
export function eraFromYear(yearBuilt: number | null | undefined): Era {
  if (yearBuilt == null || !Number.isFinite(yearBuilt)) return "unknown";
  if (yearBuilt < 1700 || yearBuilt > 2100) return "unknown"; // implausible
  if (yearBuilt < 1945) return "pre1945";
  if (yearBuilt <= 1980) return "1945_1980";
  return "post1980";
}

export interface ResolvedEfficiency {
  gia_from_gea: number;
  nia_from_gia: number;
  market: Market;
  buildingType: BuildingType;
  era: Era;
  /** Citation for the chosen stratum. */
  source: string;
  /** 0..1 confidence, already penalized for any fallback. */
  confidence: number;
  /** True when era was unknown and the post-1980 cell was used as a stand-in. */
  fallbackApplied: boolean;
  version: string;
  /** Stable id naming the exact stratum, e.g. "efficiency_v2_2026Q2:UK_RICS:residential:1945_1980". */
  ruleId: string;
}

/**
 * Resolve stratified factors for a building. Always returns a usable result:
 *  - unknown building type → `unknown` row (factors 1.0, confidence 0.3)
 *  - unknown era → post-1980 cell, confidence × 0.8, `fallbackApplied = true`
 *  - uncalibrated market (US/IN) → degraded confidence from the table, never throws
 */
export function resolveEfficiencyFactors(args: {
  buildingType: BuildingType;
  yearBuilt: number | null | undefined;
  market?: Market;
  version?: string;
}): ResolvedEfficiency {
  const market = args.market ?? DEFAULT_MARKET;
  const version = args.version ?? CURRENT_FACTOR_TABLE_VERSION;

  const table = STRATIFIED_EFFICIENCY_TABLES[version];
  if (!table) throw new Error(`Unknown stratified factor table version: ${version}`);

  const marketTable = table[market] ?? table[DEFAULT_MARKET];
  const effectiveType: BuildingType = marketTable[args.buildingType] ? args.buildingType : "unknown";
  const typeBlock = marketTable[effectiveType];

  const era = eraFromYear(args.yearBuilt);
  const fallbackApplied = era === "unknown";
  const cellEra: Exclude<Era, "unknown"> = fallbackApplied ? "post1980" : era;
  const cell = typeBlock[cellEra];

  const confidence = fallbackApplied
    ? Math.round(cell.confidence * ERA_FALLBACK_PENALTY * 100) / 100
    : cell.confidence;

  return {
    gia_from_gea: cell.gia_from_gea,
    nia_from_gia: cell.nia_from_gia,
    market,
    buildingType: effectiveType,
    era,
    source: cell.source,
    confidence,
    fallbackApplied,
    version,
    ruleId: `${version}:${market}:${effectiveType}:${cellEra}${fallbackApplied ? "(era-fallback)" : ""}`,
  };
}
