// Investigation: prove the exact multipolygon failure mode on real OSM data.
// Pulls the Old (circular) and New (triangular) Parliament buildings in New
// Delhi, converts with osmtogeojson exactly like the app, then compares:
//   (A) OLD logic      — raw turf area(feature) / length(feature)
//   (B) CURRENT logic  — outer-minus-holes + perimeter-from-outer + warning
//   (C) ring anatomy   — per-ring signed/abs areas so we can see role errors
//
// Run: node web/scripts/geom-check.mjs
import { area, length } from "@turf/turf";
import osmtogeojson from "osmtogeojson";

const M_PER_KM = 1000;

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

// Parliament complex, New Delhi — Old (circular Sansad Bhavan) + New (triangular).
const LAT = 28.6170, LNG = 77.2085, RADIUS = 350;
const QUERY = `
[out:json][timeout:60];
(
  way["building"](around:${RADIUS},${LAT},${LNG});
  relation["building"](around:${RADIUS},${LAT},${LNG});
);
out geom;
`.trim();

async function fetchOverpass() {
  for (const url of MIRRORS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "measura-geom-check/1.0 (investigation)",
        },
        body: "data=" + encodeURIComponent(QUERY),
        signal: AbortSignal.timeout(60000),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok || !ct.includes("json")) {
        console.warn(`  ${url} -> ${res.status} ${ct}, trying next`);
        continue;
      }
      console.log(`  source: ${url}`);
      return await res.json();
    } catch (e) {
      console.warn(`  ${url} failed: ${e.message}`);
    }
  }
  throw new Error("all mirrors failed");
}

function ringAreaSigned(ring) {
  // turf-style spherical ring area WITHOUT the abs, so we can see winding sign.
  const R = 6371008.8;
  const FACTOR = (R * R) / 2;
  const D2R = Math.PI / 180;
  const n = ring.length - 1;
  if (n <= 2) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const lower = ring[i];
    const middle = ring[i + 1 === n ? 0 : i + 1];
    const upper = ring[i + 2 >= n ? (i + 2) % n : i + 2];
    total += (upper[0] * D2R - lower[0] * D2R) * Math.sin(middle[1] * D2R);
  }
  return total * FACTOR;
}

function ringAbsArea(ring) {
  if (ring.length < 4) return 0;
  return area({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } });
}
function ringLen(ring) {
  if (ring.length < 2) return 0;
  return length({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ring } }, { units: "kilometers" }) * M_PER_KM;
}
function polygonsOf(f) {
  return f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
}

// CURRENT app logic (verbatim from measurements.ts)
function currentLogic(f) {
  let outerArea = 0, holeArea = 0, perimeter_m = 0;
  for (const poly of polygonsOf(f)) {
    const [outer, ...holes] = poly;
    if (outer) { outerArea += ringAbsArea(outer); perimeter_m += ringLen(outer); }
    for (const hole of holes) holeArea += ringAbsArea(hole);
  }
  const net = outerArea - holeArea;
  const geometry_warning = net <= 0;
  return { area_m2: geometry_warning ? outerArea : net, perimeter_m, geometry_warning, outerArea, holeArea };
}

const json = await fetchOverpass();
const fc = osmtogeojson(json);

const polys = fc.features.filter(
  (f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"),
);

console.log(`\nFetched ${polys.length} polygon/multipolygon features.`);

// Focus on the interesting ones: multipolygons (relations w/ holes) + anything
// the OLD logic breaks on. Print those first, then a one-line summary of rest.
const interesting = polys.filter(
  (f) => f.geometry.type === "MultiPolygon" || polygonsOf(f).some((p) => p.length > 1),
);
console.log(`${interesting.length} have holes or are multipolygons (the suspects).\n`);

for (const f of interesting) {
  const name = f.properties?.name ?? f.properties?.["name:en"] ?? "(unnamed)";
  console.log("=".repeat(70));
  console.log(`${name}  [${f.geometry.type}]  id=${f.id}`);

  // (A) OLD logic
  let oldArea, oldPerim;
  try { oldArea = area(f); oldPerim = length(f, { units: "kilometers" }) * M_PER_KM; }
  catch (e) { oldArea = `ERR ${e.message}`; oldPerim = "ERR"; }

  // (B) CURRENT logic
  const cur = currentLogic(f);

  // (C) ring anatomy
  console.log("  ring anatomy (per polygon group):");
  polygonsOf(f).forEach((poly, gi) => {
    poly.forEach((ring, ri) => {
      const signed = ringAreaSigned(ring);
      const abs = ringAbsArea(ring);
      const role = ri === 0 ? "OUTER(coords[0])" : `hole[${ri}]`;
      const wind = signed >= 0 ? "CCW(+)" : "CW(-)";
      console.log(
        `    g${gi} ${role.padEnd(16)} pts=${String(ring.length).padStart(4)} ` +
        `abs=${abs.toFixed(0).padStart(8)} m²  signed=${signed.toFixed(0).padStart(9)} ${wind}`,
      );
    });
  });

  console.log(`  (A) OLD     area=${typeof oldArea === "number" ? oldArea.toFixed(1) : oldArea} m²   perim=${typeof oldPerim === "number" ? oldPerim.toFixed(1) : oldPerim} m`);
  console.log(`  (B) CURRENT area=${cur.area_m2.toFixed(1)} m²   perim=${cur.perimeter_m.toFixed(1)} m   warning=${cur.geometry_warning}  (outer=${cur.outerArea.toFixed(0)} holes=${cur.holeArea.toFixed(0)})`);
}
console.log("=".repeat(70));
