import type { SourceFingerprint } from "./types";

/**
 * Computes a SHA-256 token over canonicalized JSON of the method, inputs, and source fingerprint.
 * This is an async function because Web Crypto API is async.
 */
export async function generateProvenanceToken(
  method: string,
  inputs: string[],
  sourceFingerprint: SourceFingerprint
): Promise<string> {
  const payload = {
    inputs: [...inputs].sort(), // Deterministic input order
    method,
    sourceFingerprint,
  };

  // Canonicalize to string (very simplified for MVP, ideally use a fast-json-stable-stringify equivalent)
  const canonicalString = JSON.stringify(payload, Object.keys(payload).sort());

  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}
