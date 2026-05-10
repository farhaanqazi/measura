import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";

/**
 * GET /api/geocode?q=<address>&limit=<n>
 *
 * Server-side proxy to Photon (Komoot's free OSM geocoder). Photon is used
 * instead of Nominatim because the OSM Foundation's Nominatim instance
 * frequently blocks shared/cloud IPs regardless of User-Agent. Photon has
 * no key, no IP blocking, and similar fair-use limits.
 *
 * Response shape is normalized to match the legacy Nominatim consumer
 * contract: `{ results: [{ place_id, display_name, lat, lon, type }] }`.
 *
 * https://photon.komoot.io
 */

const SearchParamsSchema = z.object({
  q: z.string().min(2).max(200),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  /** ISO 3166-1 alpha-2 country code, e.g. "us" — Photon uses `lang` and `osm_tag` for refinement. */
  lang: z.string().regex(/^[a-z]{2}$/i).optional(),
});

interface PhotonFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: "N" | "W" | "R";
    osm_key?: string;
    type?: string;
    name?: string;
    country?: string;
    city?: string;
    state?: string;
    postcode?: string;
    street?: string;
    housenumber?: string;
  };
}

interface NormalizedResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
}

export const runtime = "nodejs";
export const revalidate = 86_400; // CDN cache geocode responses for 24h

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

  const params = new URLSearchParams({
    q: parsed.data.q,
    limit: String(parsed.data.limit),
  });
  if (parsed.data.lang) params.set("lang", parsed.data.lang);

  const upstream = await fetch(`${env.PHOTON_BASE_URL}/api/?${params}`, {
    headers: {
      "User-Agent": env.GEOCODER_USER_AGENT,
      Accept: "application/json",
    },
    next: { revalidate: 86_400 },
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Geocoder upstream error", status: upstream.status },
      { status: 502 },
    );
  }

  const data = (await upstream.json()) as { features?: PhotonFeature[] };
  const results: NormalizedResult[] = (data.features ?? []).map((f) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    const display = [
      p.name,
      p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street,
      p.city,
      p.state,
      p.postcode,
      p.country,
    ]
      .filter(Boolean)
      .join(", ");
    return {
      place_id: p.osm_id ?? Math.floor(lat * 1e7),
      display_name: display || p.name || "Unknown place",
      lat: String(lat),
      lon: String(lon),
      type: p.type ?? p.osm_key,
    };
  });

  return NextResponse.json(
    { results },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
