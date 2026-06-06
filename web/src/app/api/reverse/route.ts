import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";

/**
 * GET /api/reverse?lat=<y>&lng=<x>
 *
 * Reverse-geocodes a point via Photon (Komoot) so any feature — including
 * hand-drawn polygons with no OSM tags — can show a name / address / postcode
 * for its centroid. Returns { place: {...} | null }; never throws upstream.
 */
const SearchParamsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const runtime = "nodejs";
export const revalidate = 86400; // 1d — addresses are stable

export interface ReversePlace {
  name: string | null;
  housenumber: string | null;
  street: string | null;
  postcode: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  osm_id: number | null;
  osm_type: string | null;
}

export async function GET(request: NextRequest) {
  const parsed = SearchParamsSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json({ place: null, error: "Invalid query" }, { status: 400 });
  }

  const { lat, lng } = parsed.data;

  try {
    const r = await fetch(`${env.PHOTON_BASE_URL}/reverse?lat=${lat}&lon=${lng}`, {
      headers: { "User-Agent": env.GEOCODER_USER_AGENT },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return NextResponse.json({ place: null });

    const data = (await r.json()) as {
      features?: Array<{ properties?: Record<string, unknown> }>;
    };
    const p = data.features?.[0]?.properties;
    if (!p) return NextResponse.json({ place: null });

    const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : null);
    const place: ReversePlace = {
      name: str("name"),
      housenumber: str("housenumber"),
      street: str("street"),
      postcode: str("postcode"),
      city: str("city") ?? str("district") ?? str("county"),
      state: str("state"),
      country: str("country"),
      osm_id: typeof p["osm_id"] === "number" ? (p["osm_id"] as number) : null,
      osm_type: str("osm_type"),
    };

    return NextResponse.json(
      { place },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (error) {
    console.warn("[reverse] failed:", (error as Error).message);
    return NextResponse.json({ place: null });
  }
}
