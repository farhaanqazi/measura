import { NextResponse } from "next/server";

export const runtime = "edge";

/**
 * Phase 5: Machine-readable Export
 * GET /api/export/[id]
 * Retrieves the full Provenance-Validated Measurement Record as JSON.
 * 
 * Note: In a real implementation, this would query the Supabase database
 * for the `MeasurementRecord` stored inside the feature properties.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: "Missing measurement ID" }, { status: 400 });
  }

  // TODO: Implement actual Supabase fetch
  // const { data, error } = await supabase.from('measurements').select('properties->provenance').eq('id', id).single();
  
  // Mock payload representing what the OpenAPI spec would document
  const mockRecord = {
    id,
    pipelineVersion: "1.0.0",
    factorTableVersion: "efficiency_v1_2026Q2",
    inputFingerprint: "hash_of_input_geometry",
    footprint_m2: {
      value: 412.5,
      unit: "m2",
      tier: "measured",
      method: "turf.area@1",
      inputs: [],
      token: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      confidence: 0.95,
      source: {
        kind: "osm",
        fingerprint: { kind: "osm", elementType: "way", id: 123456, version: 2, timestamp: "2026-06-16T12:00:00Z" },
        retrievedAt: "2026-06-16T12:01:00Z"
      }
    },
    // ... gea_m2, gia_m2, nia_m2 would follow the same structure
  };

  return NextResponse.json({
    status: "success",
    data: mockRecord
  });
}
