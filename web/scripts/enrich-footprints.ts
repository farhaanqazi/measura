/**
 * enrich-footprints.ts — turn EPC candidate rows (address + year + floor area,
 * but NO geometry) into harness-ready ground-truth rows by pulling each
 * building's real outline + storey count from OpenStreetMap.
 *
 * PIPELINE per row:
 *   EPC address+postcode ──geocode(Nominatim)──► lat/lng
 *                         ──Overpass(around 35m)──► nearest building polygon
 *                         ──extract building:levels──► storey count
 *   → write { floors, total_area_sqm (EPC), geojson, yearBuilt, ... }
 *
 * HONESTY: address→building matching is heuristic. Each row gets a match
 * distance + confidence; rows with no nearby building, or no OSM storey count,
 * are flagged and EXCLUDED from the harness-ready output (never silently
 * guessed). EPC `total_floor_area_m2` is the GROUND TRUTH the harness scores
 * footprint×floors×factor against.
 *
 * RUN (from web/, after fetch-ground-truth.ts):
 *   npx -y tsx scripts/enrich-footprints.ts \
 *     --in test/ground-truth/epc-candidates.json \
 *     --out test/ground-truth/dataset.epc.json
 *
 * Be a good API citizen: Nominatim is throttled to ~1 req/s. ~200 rows ≈ 4-5 min.
 */

import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";
import { loadEnvLocal } from "./load-env";

loadEnvLocal();

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS = process.env.OVERPASS_BASE_URL ?? "https://overpass-api.de/api/interpreter";
const UA = process.env.GEOCODER_USER_AGENT ?? "Measura-GroundTruth/0.1 (calibration script)";
const SEARCH_RADIUS_M = 35;

function arg(name: string, dflt?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
}
const inPath = path.join(__dirname, "..", arg("in", "test/ground-truth/epc-candidates.json")!);
const outPath = path.join(__dirname, "..", arg("out", "test/ground-truth/dataset.epc.json")!);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface EpcRow {
  id: string;
  address: string;
  postcode: string;
  buildingType: string;
  market: string;
  yearBuilt: number | null;
  era: string;
  total_floor_area_m2: number | null;
  citation: string;
}

interface OverpassWay {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

async function geocode(query: string): Promise<[number, number] | null> {
  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=gb`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const rows = (await res.json()) as { lat: string; lon: string }[];
  if (!rows.length) return null;
  return [Number(rows[0].lon), Number(rows[0].lat)]; // [lng, lat]
}

async function nearestBuilding(lng: number, lat: number): Promise<OverpassWay | null> {
  const q = `[out:json][timeout:25];way["building"](around:${SEARCH_RADIUS_M},${lat},${lng});out geom tags;`;
  const res = await fetch(OVERPASS, { method: "POST", body: q, headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const body = (await res.json()) as { elements?: OverpassWay[] };
  const ways = (body.elements ?? []).filter((w) => w.geometry && w.geometry.length >= 4);
  if (!ways.length) return null;

  const pt = turf.point([lng, lat]);
  let best: OverpassWay | null = null;
  let bestDist = Infinity;
  for (const w of ways) {
    const ring = w.geometry!.map((g) => [g.lon, g.lat]);
    ring.push(ring[0]); // close
    const poly = turf.polygon([ring]);
    // distance 0 if the point is inside; else distance to the polygon boundary
    const inside = turf.booleanPointInPolygon(pt, poly);
    const d = inside ? 0 : turf.pointToLineDistance(pt, turf.polygonToLine(poly) as any, { units: "meters" });
    if (d < bestDist) { bestDist = d; best = w; }
  }
  (best as any).__dist = bestDist;
  return best;
}

function toFeature(way: OverpassWay) {
  const ring = way.geometry!.map((g) => [g.lon, g.lat]);
  ring.push(ring[0]);
  return { type: "Feature", properties: { osm_id: way.id }, geometry: { type: "Polygon", coordinates: [ring] } };
}

async function main() {
  const rows = JSON.parse(fs.readFileSync(inPath, "utf8")) as EpcRow[];
  console.log(`Enriching ${rows.length} EPC rows with OSM footprints + storeys...`);

  const enriched: any[] = [];
  let matched = 0, noBuilding = 0, noLevels = 0, noGeocode = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const query = `${r.address}, ${r.postcode}`.trim();
    process.stdout.write(`[${i + 1}/${rows.length}] ${query.slice(0, 40).padEnd(40)} `);

    let point: [number, number] | null = null;
    try { point = await geocode(query); } catch { /* network */ }
    await sleep(1100); // Nominatim ~1 req/s

    if (!point) { noGeocode++; console.log("✗ no geocode"); continue; }

    let way: OverpassWay | null = null;
    try { way = await nearestBuilding(point[0], point[1]); } catch { /* network */ }
    await sleep(400);

    if (!way) { noBuilding++; console.log("✗ no OSM building"); continue; }

    const levels = way.tags?.["building:levels"];
    const floors = levels ? Number(levels) : null;
    const dist = Math.round((way as any).__dist ?? 0);

    if (!floors || !Number.isFinite(floors)) {
      noLevels++;
      console.log(`~ matched(${dist}m) but no building:levels — needs manual storeys`);
      // keep it but mark unusable for the harness (no floors)
      enriched.push({
        name: r.id, location: r.postcode, floors: null,
        total_area_sqm: r.total_floor_area_m2, geojson: toFeature(way),
        buildingType: "residential", yearBuilt: r.yearBuilt, market: "UK_RICS",
        citation: `${r.citation}; footprint OSM way/${way.id}`,
        match: { distance_m: dist, confidence: dist <= 5 ? 0.7 : 0.4, usable: false, reason: "no_osm_levels" },
      });
      continue;
    }

    matched++;
    console.log(`✓ matched(${dist}m) levels=${floors}`);
    enriched.push({
      name: r.id, location: r.postcode, floors,
      total_area_sqm: r.total_floor_area_m2, geojson: toFeature(way),
      buildingType: "residential", yearBuilt: r.yearBuilt, market: "UK_RICS",
      citation: `${r.citation}; footprint OSM way/${way.id} (building:levels)`,
      match: { distance_m: dist, confidence: dist <= 5 ? 0.85 : 0.55, usable: true },
    });
  }

  // Harness-ready = matched + has floors + has a real floor area.
  const usable = enriched.filter((e) => e.match.usable && e.total_area_sqm);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(usable, null, 2));
  fs.writeFileSync(outPath.replace(/\.json$/, ".all.json"), JSON.stringify(enriched, null, 2));

  console.log("\n=== Enrichment complete ===");
  console.log(`Geocoded + building matched + storeys: ${matched}`);
  console.log(`Matched but no OSM storeys (manual):   ${noLevels}`);
  console.log(`No OSM building near point:            ${noBuilding}`);
  console.log(`No geocode:                            ${noGeocode}`);
  console.log(`\nHarness-ready rows written: ${usable.length} → ${outPath}`);
  console.log(`Full annotated set:               ${outPath.replace(/\.json$/, ".all.json")}`);
  console.log(`\nNEXT: point the harness at this file and run with the train/test split:`);
  console.log(`  (copy to dataset.json or add a --dataset flag)  npx -y tsx scripts/accuracy-report.ts`);
}

main().catch((e) => { console.error(e); process.exit(1); });
