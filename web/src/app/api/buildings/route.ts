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

// Public Overpass instances are individually flaky (downtime, HTML error
// pages, rate limits). Cascade through several until one returns valid JSON,
// rather than depending on a single hardcoded mirror. The env value is tried
// first so it can be overridden; the rest are known planet-wide fallbacks.
const MIRRORS = [
  env.OVERPASS_BASE_URL,
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
].filter((v, i, a) => a.indexOf(v) === i);

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  version?: number;
  timestamp?: string;
  changeset?: number;
  uid?: number;
  user?: string;
}

async function queryOverpass(query: string): Promise<OsmElement[] | null> {
  for (const url of MIRRORS) {
    try {
      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": env.GEOCODER_USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(20000),
      });
      const contentType = upstream.headers.get("content-type") ?? "";
      if (!upstream.ok || !contentType.includes("json")) {
        console.warn(`[buildings] ${url} -> ${upstream.status} ${contentType}`);
        continue;
      }
      const data = (await upstream.json()) as { elements?: OsmElement[] };
      return data.elements ?? [];
    } catch (error) {
      console.warn(`[buildings] ${url} failed:`, (error as Error).message);
    }
  }
  return null;
}

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

  // Overpass QL: any building (way or relation) within `radius` of (lat,lng),
  // returning geometry inline. `out geom 30` caps elements to keep payload small.
  const query = `
    [out:json][timeout:25];
    (
      way["building"](around:${radius},${lat},${lng});
      relation["building"](around:${radius},${lat},${lng});
    );
    out geom meta 30;
  `.trim();

  const elements = await queryOverpass(query);
  if (elements === null) {
    return NextResponse.json(
      { error: "All Overpass mirrors failed or timed out", elements: [] },
      { status: 504 },
    );
  }

  return NextResponse.json(
    { elements },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
