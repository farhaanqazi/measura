import { ProvenancedValue, ProvenanceSource } from "../provenance/types";
import { generateProvenanceToken } from "../provenance/token";
import { BuildingHeight } from "./height";

/**
 * Derives the floor count based on a strict hierarchy:
 * 1. OSM `building:levels` tag
 * 2. Inferred from `BuildingHeight` (using an assumed floor-to-floor spacing)
 * 3. AI Proposal from imagery (fallback)
 */
export async function deriveFloors(
  tags: Record<string, string | undefined> | undefined,
  heightData: BuildingHeight | null,
  aiProposal?: number,
  sourceOSM?: ProvenanceSource,
  sourceAI?: ProvenanceSource
): Promise<ProvenancedValue | undefined> {
  const method = "deriveFloors@1";

  // Priority 1: Direct OSM tag
  if (tags && tags["building:levels"]) {
    const lvls = parseInt(tags["building:levels"], 10);
    if (!isNaN(lvls) && sourceOSM) {
      const token = await generateProvenanceToken(method, [], sourceOSM.fingerprint);
      return {
        value: lvls,
        unit: "count",
        tier: "derived",
        method,
        inputs: [],
        token,
        confidence: 0.9,
        source: sourceOSM
      };
    }
  }

  // Priority 2: Estimated from height
  if (heightData) {
    const assumedSpacing = 3.0; // Typical mixed/residential spacing
    const lvls = Math.max(1, Math.round(heightData.meters / assumedSpacing));
    const token = await generateProvenanceToken(method, [], heightData.source.fingerprint);
    return {
      value: lvls,
      unit: "count",
      tier: "estimated",
      method,
      inputs: [],
      token,
      confidence: 0.6,
      source: heightData.source
    };
  }

  // Priority 3: LLM Proposal
  if (aiProposal !== undefined && aiProposal > 0 && sourceAI) {
    const token = await generateProvenanceToken(method, [], sourceAI.fingerprint);
    return {
      value: aiProposal,
      unit: "count",
      tier: "estimated",
      method,
      inputs: [],
      token,
      confidence: 0.4,
      source: sourceAI
    };
  }

  return undefined;
}
