import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";

/**
 * GET /api/elevation?lat=<y>&lng=<x>
 *
 * Server-side proxy to Open-Meteo's free Elevation API. Returns the
 * ground-level elevation in meters above mean sea level (Copernicus DEM 90m).
 *
 * Note: this is BARE-EARTH elevation. Buildings and trees are not included.
 * Combine with an OSM `height` tag to estimate roof elevation.
 *
 * https://open-meteo.com/en/docs/elevation-api
 */

const SearchParamsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const runtime = "nodejs";
export const revalidate = 86_400 * 30; // 30 days — ground elevation never changes

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

  const { lat, lng } = parsed.data;
  const url = `${env.OPEN_METEO_BASE_URL}/v1/elevation?latitude=${lat}&longitude=${lng}`;

  const upstream = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86_400 * 30 },
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Elevation upstream error", status: upstream.status },
      { status: 502 },
    );
  }

  const data = (await upstream.json()) as { elevation?: number[] };
  const elevation_m = data.elevation?.[0] ?? null;

  return NextResponse.json(
    { elevation_m, lat, lng },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=2592000, stale-while-revalidate=2592000",
      },
    },
  );
}
