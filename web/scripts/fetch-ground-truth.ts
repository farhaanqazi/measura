/**
 * ⚠️ TARGETS THE RETIRED EPC API — NEEDS A REWRITE (discovered 2026-06-17).
 *
 * The old epc.opendatacommunities.org API was switched off on 30 May 2026 and
 * 301-redirects to a redesigned service. The new API (verified live):
 *   • Search:  GET https://api.get-energy-performance-data.communities.gov.uk/api/domestic/search
 *               ?council[]=<NAME>&postcode=<pc>&page_size=<n>&current_page=<p>
 *               → { data:[{ certificateNumber, uprn, addressLine1.., postcode }], pagination:{ nextPage,.. } }
 *   • Detail:  GET .../api/certificate?certificate_number=<num>
 *               → { data:{ total_floor_area, habitable_room_count, property_type(code),
 *                          built_form(code), floors(=construction info, NOT storeys), ... } }
 *   • Auth:    Authorization: Bearer <EPC_API_KEY>   (NOT Basic email:key)
 *   • Filter:  council[] takes council NAMES, not ONS codes.
 *   • ❗ NO construction-age-band field anymore → era must come from another source
 *      (OSM start_date, or a separate dataset). total_floor_area IS present (good).
 *
 * Rewrite = search → collect certificateNumbers → fetch each /api/certificate →
 * map total_floor_area (ground truth) + buildingType "residential". Storeys still
 * come from OSM (enrich-footprints.ts); era is the open question.
 *
 * ── Original (now-defunct) description ──
 * Pull ~200 ground-truth buildings (with build year + reference floor area) from
 * the FREE UK EPC Open Data register, to calibrate the stratified efficiency
 * factors (efficiency_v2).
 *
 * WHY EPC: it is the cheapest large, free source that publishes — per address —
 *   • total-floor-area (m²)        → reference NIA/GIA to score against
 *   • construction-age-band        → era stratum (pre1945 / 1945_1980 / post1980)
 *   • property-type + built-form   → building type
 * Footprints are NOT in EPC: you still draw/trace the polygon per row before the
 * accuracy harness can run. This script produces the *attribute* answer-key.
 *
 * SETUP (one-time, free):
 *   1. Register at https://epc.opendatacommunities.org/ to get an API key.
 *   2. Set env vars before running:
 *        $env:EPC_EMAIL   = "you@example.com"
 *        $env:EPC_API_KEY = "your-api-key"
 *
 * RUN (from web/):
 *   npx -y tsx scripts/fetch-ground-truth.ts --local-authority E09000033 --size 200
 *   npx -y tsx scripts/fetch-ground-truth.ts --postcode "SW1A 1AA" --size 50
 *
 * OUTPUT:
 *   test/ground-truth/epc-candidates.csv   (one row per building, with citation)
 *   test/ground-truth/epc-candidates.json  (same, ready to enrich with geometry)
 *
 * Args:
 *   --local-authority <ONS code>   e.g. E09000033 (City of Westminster)
 *   --postcode <code>              e.g. "SW1A 1AA"
 *   --size <n>                     target number of rows (default 200)
 *   --property-type <type>         optional EPC filter (e.g. House, Flat, Bungalow)
 *   --out <path>                   output basename (default test/ground-truth/epc-candidates)
 */

import fs from "fs";
import path from "path";
import { loadEnvLocal } from "./load-env";

loadEnvLocal();

// The EPC register migrated from epc.opendatacommunities.org to this GOV.UK domain.
const API =
  process.env.EPC_API_BASE ??
  "https://get-energy-performance-data.communities.gov.uk/api/v1/domestic/search";

// ── arg parsing ──────────────────────────────────────────────────────────────
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const localAuthority = arg("local-authority");
const postcode = arg("postcode");
const propertyType = arg("property-type");
const targetSize = Number(arg("size") ?? 200);
const outBase = arg("out") ?? path.join(__dirname, "../test/ground-truth/epc-candidates");

const EPC_EMAIL = process.env.EPC_EMAIL;
const EPC_API_KEY = process.env.EPC_API_KEY;

if (!EPC_EMAIL || !EPC_API_KEY) {
  console.error("ERROR: set EPC_EMAIL and EPC_API_KEY env vars (free key at epc.opendatacommunities.org).");
  process.exit(1);
}
if (!localAuthority && !postcode) {
  console.error("ERROR: provide --local-authority <ONS code> or --postcode <code>.");
  process.exit(1);
}

const authHeader = "Basic " + Buffer.from(`${EPC_EMAIL}:${EPC_API_KEY}`).toString("base64");

// ── mapping helpers ──────────────────────────────────────────────────────────

/** EPC construction-age-band → a representative build year (band midpoint). */
function yearFromAgeBand(band: string | undefined): number | null {
  if (!band) return null;
  const cleaned = band.replace(/^England and Wales:\s*/i, "").trim();
  if (/before 1900/i.test(cleaned)) return 1880;
  const onwards = cleaned.match(/(\d{4})\s*onwards/i);
  if (onwards) return Number(onwards[1]);
  const range = cleaned.match(/(\d{4})\s*-\s*(\d{4})/);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const single = cleaned.match(/(\d{4})/);
  return single ? Number(single[1]) : null;
}

/** Mirror of efficiency-factors.ts eraFromYear (kept local so the script is standalone). */
function eraFromYear(year: number | null): string {
  if (year == null || !Number.isFinite(year) || year < 1700 || year > 2100) return "unknown";
  if (year < 1945) return "pre1945";
  if (year <= 1980) return "1945_1980";
  return "post1980";
}

/** EPC is domestic-only, so every row maps to our "residential" factor type. */
function buildingType(): "residential" {
  return "residential";
}

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── fetch with pagination (EPC uses the X-Next-Search-After cursor) ───────────

interface EpcRow {
  "lmk-key"?: string;
  address?: string;
  postcode?: string;
  "property-type"?: string;
  "built-form"?: string;
  "construction-age-band"?: string;
  "total-floor-area"?: string;
  "lodgement-date"?: string;
  "local-authority"?: string;
}

interface GroundTruthRow {
  id: string;
  address: string;
  postcode: string;
  propertyType: string;
  builtForm: string;
  buildingType: string;
  market: "UK_RICS";
  constructionAgeBand: string;
  yearBuilt: number | null;
  era: string;
  total_floor_area_m2: number | null; // EPC reference area (≈ usable/NIA)
  lodgementDate: string;
  citation: string;
  geojson: null; // ← draw/trace the footprint polygon before using in the harness
}

async function fetchPage(searchAfter: string | null): Promise<{ rows: EpcRow[]; next: string | null }> {
  const params = new URLSearchParams();
  if (localAuthority) params.set("local-authority", localAuthority);
  if (postcode) params.set("postcode", postcode);
  if (propertyType) params.set("property-type", propertyType);
  params.set("size", String(Math.min(targetSize, 5000)));
  if (searchAfter) params.set("search-after", searchAfter);

  const url = `${API}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader, Accept: "application/json" },
  });

  if (res.status === 401) throw new Error("401 Unauthorized — check EPC_EMAIL / EPC_API_KEY in .env.local.");
  if (res.status === 404 || res.status === 204) return { rows: [], next: null };
  if (!res.ok) throw new Error(`EPC API ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const body = (await res.json()) as { rows?: EpcRow[] };
  const next = res.headers.get("X-Next-Search-After");
  return { rows: body.rows ?? [], next: next || null };
}

async function main() {
  console.log(`Fetching up to ${targetSize} EPC records (${localAuthority ?? postcode})...`);

  const collected: GroundTruthRow[] = [];
  let searchAfter: string | null = null;

  while (collected.length < targetSize) {
    const { rows, next } = await fetchPage(searchAfter);
    if (rows.length === 0) break;

    for (const r of rows) {
      const year = yearFromAgeBand(r["construction-age-band"]);
      collected.push({
        id: r["lmk-key"] ?? `${r.postcode ?? ""}-${collected.length}`,
        address: (r.address ?? "").trim(),
        postcode: r.postcode ?? "",
        propertyType: r["property-type"] ?? "",
        builtForm: r["built-form"] ?? "",
        buildingType: buildingType(),
        market: "UK_RICS",
        constructionAgeBand: r["construction-age-band"] ?? "",
        yearBuilt: year,
        era: eraFromYear(year),
        total_floor_area_m2: toNum(r["total-floor-area"]),
        lodgementDate: r["lodgement-date"] ?? "",
        citation: `UK EPC register (lmk-key ${r["lmk-key"] ?? "?"}), epc.opendatacommunities.org`,
        geojson: null,
      });
      if (collected.length >= targetSize) break;
    }

    if (!next) break;
    searchAfter = next;
  }

  // Keep only rows usable as ground truth: a real floor area + a known era.
  const usable = collected.filter((r) => r.total_floor_area_m2 && r.era !== "unknown");

  // ── write JSON ──
  fs.mkdirSync(path.dirname(outBase), { recursive: true });
  fs.writeFileSync(`${outBase}.json`, JSON.stringify(collected, null, 2));

  // ── write CSV ──
  const cols: (keyof GroundTruthRow)[] = [
    "id", "address", "postcode", "propertyType", "builtForm", "buildingType",
    "market", "constructionAgeBand", "yearBuilt", "era", "total_floor_area_m2",
    "lodgementDate", "citation",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    cols.join(","),
    ...collected.map((r) => cols.map((c) => esc(r[c])).join(",")),
  ].join("\n");
  fs.writeFileSync(`${outBase}.csv`, csv);

  // ── era distribution summary ──
  const byEra = collected.reduce<Record<string, number>>((acc, r) => {
    acc[r.era] = (acc[r.era] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\n=== Ground-truth fetch complete ===");
  console.log(`Total fetched:        ${collected.length}`);
  console.log(`Usable (area + era):  ${usable.length}`);
  console.log(`Era distribution:     ${JSON.stringify(byEra)}`);
  console.log(`Written:              ${outBase}.csv  and  ${outBase}.json`);
  console.log("\nNEXT STEP: trace/draw each building's footprint polygon into the `geojson`");
  console.log("field (e.g. from OSM or aerial imagery), then feed into scripts/accuracy-report.ts");
  console.log("to score efficiency_v2 strata against EPC floor areas (use a train/test split).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
