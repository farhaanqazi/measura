// Throwaway probe: prove DuckDB can pull Overture building footprints for a
// bbox straight from S3 (filter pushed down — no full download).
// Run:  node scripts/overture-probe.mjs [west south east north]
// Default bbox = Buckingham Palace.
import { DuckDBInstance } from "@duckdb/node-api";

const RELEASE = "2026-05-20.0";
const [west, south, east, north] = (
  process.argv.slice(2).length === 4
    ? process.argv.slice(2).map(Number)
    : [-0.144, 51.5, -0.14, 51.503]
);

const PARQUET = `s3://overturemaps-us-west-2/release/${RELEASE}/theme=buildings/type=building/*`;

const sql = `
  INSTALL spatial; LOAD spatial;
  INSTALL httpfs; LOAD httpfs;
  SET s3_region='us-west-2';
  SELECT
    id,
    height,
    (names).primary AS name,
    ST_AsGeoJSON(geometry) AS geometry
  FROM read_parquet('${PARQUET}')
  WHERE bbox.xmin <= ${east} AND bbox.xmax >= ${west}
    AND bbox.ymin <= ${north} AND bbox.ymax >= ${south}
  LIMIT 50;
`;

console.log(`Querying Overture ${RELEASE} for bbox [${west}, ${south}, ${east}, ${north}] ...`);
const t0 = Date.now();

const instance = await DuckDBInstance.create(":memory:");
const conn = await instance.connect();
const reader = await conn.runAndReadAll(sql);
const rows = reader.getRowObjects();

const ms = Date.now() - t0;
console.log(`\n${rows.length} footprints in ${(ms / 1000).toFixed(1)}s`);
console.log("with height:", rows.filter((r) => r.height != null).length);
console.log("\nsample:");
for (const r of rows.slice(0, 8)) {
  console.log(
    `  ${String(r.name ?? "(unnamed)").padEnd(28)} h=${r.height ?? "—"}`,
  );
}
