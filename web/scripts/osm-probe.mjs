// Verify osmtogeojson converts an OSM relation into a Polygon/MultiPolygon
// WITH inner rings (courtyard holes). Buckingham Palace = relation 5208404.
import osmtogeojson from "osmtogeojson";
import { area as turfArea, booleanPointInPolygon } from "@turf/turf";

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const UA = "Mozilla/5.0 (compatible; MeasuraBot/0.1; +https://measura.app)";

const lat = 51.501, lng = -0.1419;
const q = `[out:json][timeout:25];(way["building"](around:80,${lat},${lng});relation["building"](around:80,${lat},${lng}););out geom 30;`;

async function fetchOverpass() {
  for (const url of MIRRORS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
        body: "data=" + encodeURIComponent(q),
        signal: AbortSignal.timeout(30000),
      });
      const ct = r.headers.get("content-type") ?? "";
      if (!r.ok || !ct.includes("json")) {
        console.log(`  ${url} -> ${r.status} ${ct.slice(0, 30)} (skip)`);
        continue;
      }
      const j = await r.json();
      console.log(`  ${url} -> OK ${j.elements?.length ?? 0} elements`);
      return j.elements ?? [];
    } catch (e) {
      console.log(`  ${url} -> ${e.message} (skip)`);
    }
  }
  throw new Error("all mirrors failed");
}

const elements = await fetchOverpass();
const fc = osmtogeojson({ elements });
const polys = fc.features.filter(
  (f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"),
);
console.log("\npolygon features:", polys.length);
for (const f of polys.slice(0, 8)) {
  const g = f.geometry;
  let outer = 0, holes = 0;
  if (g.type === "Polygon") { outer = 1; holes = g.coordinates.length - 1; }
  else { for (const p of g.coordinates) { outer++; holes += p.length - 1; } }
  console.log(`  ${f.id}  ${g.type}  name='${f.properties?.name ?? ""}'  outerRings=${outer} holes=${holes}`);
}

// Replicate pickBestBuilding: smallest footprint containing the click.
const containing = polys.filter((f) => {
  try { return booleanPointInPolygon([lng, lat], f); } catch { return false; }
});
const pool = containing.length ? containing : polys;
pool.sort((a, b) => turfArea(a) - turfArea(b));
const best = pool[0];
if (best) {
  const m2 = turfArea(best);
  console.log(
    `\nSELECTED ${best.id} '${best.properties?.name ?? ""}'  area = ${m2.toFixed(0)} m²  = ${(m2 / 4046.86).toFixed(2)} acres`,
  );
  console.log("(official Buckingham footprint ≈ 12,960 m² / 3.2 ac; your manual trace was 5.42 ac)");
}
