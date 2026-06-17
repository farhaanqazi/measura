import { ProvenancedValue, ProvenanceSource } from "../provenance/types";
import { generateProvenanceToken } from "../provenance/token";
import { BuildingType, Market, resolveEfficiencyFactors } from "./efficiency-factors";

export interface DeriveAreasOptions {
  /** Construction year, used to pick the era stratum. Null/missing → era-fallback. */
  yearBuilt?: number | null;
  /** Region + measurement standard. Defaults to UK_RICS. */
  market?: Market;
  /** Override the factor-table version (defaults to current stratified v2). */
  factorVersion?: string;
}

/**
 * Derives GEA, GIA, and NIA (Carpet) areas from footprint and floor count using
 * the STRATIFIED (v2) efficiency factors — type × era × market.
 *
 * GIA/NIA are tagged `tier: "estimated"` with a `heuristic` source whose
 * `ruleId` names the exact stratum used, and a confidence that already absorbs
 * the factor's own confidence (and any era-fallback penalty).
 */
export async function deriveAreas(
  footprint: ProvenancedValue,
  floors: ProvenancedValue,
  buildingType: BuildingType,
  options: DeriveAreasOptions = {}
): Promise<{ gea_m2: ProvenancedValue; gia_m2: ProvenancedValue; nia_m2: ProvenancedValue }> {
  // 1. Gross External Area (GEA) = footprint * floors
  const geaMethod = "gea=footprint*floors@1";
  const geaValue = footprint.value * floors.value;
  const geaToken = await generateProvenanceToken(
    geaMethod,
    [footprint.token, floors.token], // Using tokens as deterministic input references
    footprint.source.fingerprint
  );

  const gea_m2: ProvenancedValue = {
    value: geaValue,
    unit: "m2",
    tier: "derived",
    method: geaMethod,
    inputs: [footprint.token, floors.token],
    token: geaToken,
    confidence: Math.min(footprint.confidence ?? 1, floors.confidence ?? 1),
    source: footprint.source, // Inherits source from the primary geometric measurement
  };

  // Resolve the stratified factor for this building's type / era / market.
  const factors = resolveEfficiencyFactors({
    buildingType,
    yearBuilt: options.yearBuilt ?? null,
    market: options.market,
    version: options.factorVersion,
  });

  // Heuristic provenance source: the factor came from a versioned rule, not geometry.
  const factorSource: ProvenanceSource = {
    kind: "heuristic",
    fingerprint: { kind: "heuristic", ruleId: factors.ruleId },
    retrievedAt: footprint.source.retrievedAt,
  };

  // 2. Gross Internal Area (GIA) = GEA * factor
  const giaMethod = `gia=gea*factor@2${factors.fallbackApplied ? "|era-fallback" : ""}`;
  const giaValue = geaValue * factors.gia_from_gea;
  const giaToken = await generateProvenanceToken(giaMethod, [gea_m2.token], factorSource.fingerprint);

  const gia_m2: ProvenancedValue = {
    value: giaValue,
    unit: "m2",
    tier: "estimated", // factor-derived, never a measured/certified GIA
    method: giaMethod,
    inputs: [gea_m2.token],
    token: giaToken,
    confidence: Math.round((gea_m2.confidence ?? 1) * factors.confidence * 100) / 100,
    source: factorSource,
  };

  // 3. Net Internal Area (NIA / Carpet) = GIA * factor
  const niaMethod = `nia=gia*factor@2${factors.fallbackApplied ? "|era-fallback" : ""}`;
  const niaValue = giaValue * factors.nia_from_gia;
  const niaToken = await generateProvenanceToken(niaMethod, [gia_m2.token], factorSource.fingerprint);

  const nia_m2: ProvenancedValue = {
    value: niaValue,
    unit: "m2",
    tier: "estimated", // NIA is almost always an estimate unless physically surveyed
    method: niaMethod,
    inputs: [gia_m2.token],
    token: niaToken,
    // NIA is a further estimation step beyond GIA → small additional penalty.
    confidence: Math.round((gia_m2.confidence ?? 1) * 0.95 * 100) / 100,
    source: factorSource,
  };

  return { gea_m2, gia_m2, nia_m2 };
}
