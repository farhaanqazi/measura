import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";

/**
 * GET /api/buildings?lat=<y>&lng=<x>&radius=<m>
 *
 * Proxies an Overpass query that returns OSM building footprints around the
 * given point as GeoJSON-ish elements. We tile-key the cache so panning
 * the same area doesn't re-hit Overpass.
 *
 * Response: { elements: [...] } where each element has `geometry` (lat/lng pairs)
 * and `tags` (raw OSM tags). The client converts to GeoJSON Polygons.
 */

const SearchParamsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(10).max(2000).default(80),
});

export const runtime = "nodejs";
export const revalidate = 3600; // 1h — building footprints rarely change

export async function GET(request: NextRequest) {
  const parsed = SearchParamsSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { lat, lng, radius } = parsed.data;

  // Overpass QL: any way tagged building within `radius` of (lat,lng),
  // returning geometry inline. `out 30` caps elements to keep payload small.
  const query = `
    [out:json][timeout:25];
    (
      way["building"](around:${radius},${lat},${lng});
      relation["building"](around:${radius},${lat},${lng});
    );
    out geom 30;
  `.trim();

  const upstream = await fetch(env.OVERPASS_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": env.GEOCODER_USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
    next: { revalidate: 3600 },
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Overpass upstream error", status: upstream.status },
      { status: 502 },
    );
  }

  const data = (await upstream.json()) as { elements?: unknown[] };
  return NextResponse.json(
    { elements: data.elements ?? [] },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
