// Dev tool: freeze benchmark building geometry as committed test fixtures so the
// measurement gate runs deterministically offline (no flaky Overpass in CI).
// Re-run to refresh: node scripts/fetch-fixtures.mjs
import osmtogeojson from "osmtogeojson";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const UA = "Mozilla/5.0 (compatible; MeasuraBot/0.1; +https://measura.app)";

// Chosen to exercise distinct cases:
//  buckingham    relation, courtyard holes, area ~12,960 m² (known truth)
//  newParliament relation, MALFORMED (holes ≥ outer → fallback + warning)
//  oldParliament relation, circular with holes
//  museum        simple way, no holes (clean high-confidence case)
const IDS = {
  buckingham: "relation/5208404",
  newParliament: "relation/12737019",
  oldParliament: "relation/6087635",
  museum: "way/80926784",
};

const q =
  "[out:json][timeout:30];(relation(5208404);relation(12737019);relation(6087635);way(80926784););out geom;";

async function fetchElements() {
  const mirrors = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  for (let attempt = 1; attempt <= 5; attempt++) {
    for (const url of mirrors) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
          body: "data=" + encodeURIComponent(q),
        });
        const ct = r.headers.get("content-type") ?? "";
        if (r.ok && ct.includes("json")) return (await r.json()).elements;
        console.log(`attempt ${attempt} ${url}: ${r.status} ${ct.slice(0, 24)}`);
      } catch (e) {
        console.log(`attempt ${attempt} ${url}: ${e.message}`);
      }
    }
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error("all Overpass mirrors failed");
}

const elements = await fetchElements();
const fc = osmtogeojson({ elements });
const byId = new Map(fc.features.map((f) => [String(f.id), f]));

const out = {};
for (const [name, id] of Object.entries(IDS)) {
  const f = byId.get(id);
  if (!f) {
    console.warn(`MISSING ${name} (${id})`);
    continue;
  }
  out[name] = { type: "Feature", id: f.id, properties: f.properties ?? {}, geometry: f.geometry };
}

const dir = path.join(process.cwd(), "src", "lib", "measurement", "__fixtures__");
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, "buildings.json"), JSON.stringify(out, null, 2));
console.log("wrote fixtures:", Object.keys(out).join(", "));
