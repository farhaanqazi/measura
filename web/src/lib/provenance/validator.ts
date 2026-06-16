import { ProvenancedValue, ProvenanceTier } from "./types";
import { generateProvenanceToken } from "./token";

type RejectionReason =
  | "token-unresolved"
  | "no-measured-root"
  | "low-confidence-estimate"
  | "source-conflict";

export interface ValidationVerdict {
  accepted: boolean;
  value: ProvenancedValue;
  reason?: RejectionReason;
}

/**
 * Validates a ProvenancedValue against cryptographic and heuristic rules.
 * If validation fails, it applies a fallback heuristic, degrading the tier to "estimated".
 */
export async function validateValue(
  v: ProvenancedValue,
  // graph dictionary representing all values by their ID to check roots
  graph: Record<string, ProvenancedValue> = {} 
): Promise<ValidationVerdict> {
  // 1. Token resolution check
  const expectedToken = await generateProvenanceToken(v.method, v.inputs, v.source.fingerprint);
  if (expectedToken !== v.token) {
    return applyHeuristicFallback(v, "token-unresolved");
  }

  // 2. Check low confidence estimate
  if (v.tier === "estimated" && (v.confidence ?? 0) < 0.5) {
    return applyHeuristicFallback(v, "low-confidence-estimate");
  }

  // 3. (Optional) Chain reaches measured root - would require traversing the `graph`
  if (v.inputs.length > 0) {
    let hasMeasuredRoot = false;
    for (const inputId of v.inputs) {
       const parent = graph[inputId];
       if (parent?.tier === "measured") {
         hasMeasuredRoot = true;
         break;
       }
    }
    if (!hasMeasuredRoot) {
      // return applyHeuristicFallback(v, "no-measured-root");
    }
  }

  return { accepted: true, value: v };
}

function applyHeuristicFallback(
  v: ProvenancedValue,
  reason: RejectionReason
): ValidationVerdict {
  console.warn(`[Validator] Rejected value: ${reason}`, v);
  
  // Create a degraded fallback value
  const degraded: ProvenancedValue = {
    ...v,
    tier: "estimated" as ProvenanceTier,
    source: {
      kind: "heuristic",
      fingerprint: { kind: "heuristic", ruleId: `fallback-for-${reason}` },
      retrievedAt: new Date().toISOString(),
    },
    confidence: Math.min(v.confidence ?? 0.5, 0.3), // Penalize confidence heavily
  };

  return { accepted: false, value: degraded, reason };
}
