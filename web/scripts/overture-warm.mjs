// Measure COLD vs WARM query latency in one long-lived process.
// If the 2nd query (different bbox) is fast, on-demand fetch is viable on a
// persistent server: pay the footer-read cost once, serve fast thereafter.
import { DuckDBInstance } from "@duckdb/node-api";

const RELEASE = "2026-05-20.0";
const PARQUET = `s3://overturemaps-us-west-2/release/${RELEASE}/theme=buildings/type=building/*`;

const q = (w, s, e, n) => `
  SELECT count(*) AS n
  FROM read_parquet('${PARQUET}')
  WHERE bbox.xmin <= ${e} AND bbox.xmax >= ${w}
    AND bbox.ymin <= ${n} AND bbox.ymax >= ${s};
`;

const instance = await DuckDBInstance.create(":memory:");
const conn = await instance.connect();
await conn.run("INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs;");
await conn.run("SET s3_region='us-west-2'; SET enable_object_cache=true;");

async function timed(label, sql) {
  const t = Date.now();
  const r = await conn.runAndReadAll(sql);
  const n = r.getRowObjects()[0].n;
  console.log(`${label}: ${n} rows in ${((Date.now() - t) / 1000).toFixed(1)}s`);
}

// Cold: Buckingham Palace
await timed("COLD (Buckingham)", q(-0.144, 51.5, -0.14, 51.503));
// Warm: City of London (different files possibly, footers cached)
await timed("WARM (City of London)", q(-0.094, 51.51, -0.08, 51.518));
// Warm again: Canary Wharf
await timed("WARM (Canary Wharf)", q(-0.026, 51.503, -0.012, 51.508));
