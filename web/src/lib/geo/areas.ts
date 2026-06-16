import { ProvenancedValue } from "../provenance/types";
import { generateProvenanceToken } from "../provenance/token";
import { BuildingType, getEfficiencyFactors } from "./efficiency-factors";

/**
 * Derives GEA, GIA, and NIA (Carpet) areas from footprint and floor count.
 */
export async function deriveAreas(
  footprint: ProvenancedValue,
  floors: ProvenancedValue,
  buildingType: BuildingType
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

  const factors = getEfficiencyFactors(buildingType);

  // 2. Gross Internal Area (GIA) = GEA * factor
  const giaMethod = "gia=gea*factor@1";
  const giaValue = geaValue * factors.gia_from_gea;
  const giaToken = await generateProvenanceToken(giaMethod, [gea_m2.token], footprint.source.fingerprint);
  
  const gia_m2: ProvenancedValue = {
    value: giaValue,
    unit: "m2",
    // If the building type is unknown, everything downstream becomes a low-confidence estimate
    tier: buildingType === "unknown" ? "estimated" : "derived",
    method: giaMethod,
    inputs: [gea_m2.token],
    token: giaToken,
    confidence: buildingType === "unknown" ? 0.3 : (gea_m2.confidence ?? 1) * 0.95,
    source: footprint.source,
  };

  // 3. Net Internal Area (NIA / Carpet) = GIA * factor
  const niaMethod = "nia=gia*factor@1";
  const niaValue = giaValue * factors.nia_from_gia;
  const niaToken = await generateProvenanceToken(niaMethod, [gia_m2.token], footprint.source.fingerprint);
  
  const nia_m2: ProvenancedValue = {
    value: niaValue,
    unit: "m2",
    tier: "estimated", // NIA is almost always an estimate unless physically surveyed
    method: niaMethod,
    inputs: [gia_m2.token],
    token: niaToken,
    confidence: buildingType === "unknown" ? 0.2 : (gia_m2.confidence ?? 1) * 0.9,
    source: footprint.source,
  };

  return { gea_m2, gia_m2, nia_m2 };
}
