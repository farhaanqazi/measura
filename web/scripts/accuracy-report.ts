import fs from 'fs';
import path from 'path';
import * as turf from '@turf/turf';
import { deriveAreas } from '../src/lib/geo/areas';
import { ProvenancedValue } from '../src/lib/provenance/types';
import { generateProvenanceToken } from '../src/lib/provenance/token';
import { eraFromYear } from '../src/lib/geo/efficiency-factors';

if (!globalThis.crypto) {
  globalThis.crypto = require('crypto').webcrypto;
}

// Default to the smoke-test set; override with `--dataset test/ground-truth/dataset.epc.json`
// (relative paths resolve from the web/ root).
const WEB_ROOT = path.join(__dirname, '..');
const datasetArgIdx = process.argv.indexOf('--dataset');
const DATASET_REL = datasetArgIdx >= 0 ? process.argv[datasetArgIdx + 1] : 'test/ground-truth/dataset.json';
const DATASET_PATH = path.isAbsolute(DATASET_REL) ? DATASET_REL : path.join(WEB_ROOT, DATASET_REL);

// ── train/test split ─────────────────────────────────────────────────────────
// Deterministic 80/20 hold-out (no RNG, so the report is reproducible): every
// 5th building by index is "test", the rest are "train". The split lets us spot
// overfitting once strata are tuned — train error should not be much lower than
// test error. Pass `--split off` to score every row together.
const SPLIT_OFF = process.argv.includes('--split') &&
  process.argv[process.argv.indexOf('--split') + 1] === 'off';

function splitOf(index: number): 'train' | 'test' {
  if (SPLIT_OFF) return 'train';
  return index % 5 === 0 ? 'test' : 'train';
}

interface Bucket {
  errorSq: number;
  count: number;
  fallback: number;
}
const newBucket = (): Bucket => ({ errorSq: 0, count: 0, fallback: 0 });

function rmse(b: Bucket): string {
  return b.count ? (Math.sqrt(b.errorSq / b.count) * 100).toFixed(1) + '%' : '—';
}

async function runReport() {
  const data = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));

  console.log("=========================================");
  console.log("       MEASURA ACCURACY REPORT           ");
  console.log("=========================================\n");
  console.log(SPLIT_OFF ? "Split: OFF (all rows scored together)\n" : "Split: 80/20 deterministic hold-out (every 5th row = test)\n");
  console.log(
    "Building Name".padEnd(33) + " | " + "Split".padEnd(6) + " | " + "Era".padEnd(11) + " | " +
    "Truth".padEnd(9) + " | " + "GIA".padEnd(9) + " | " + "Conf".padEnd(6) + " | " + "Error %"
  );
  console.log("-".repeat(104));

  const bySplit: Record<'train' | 'test', Bucket> = { train: newBucket(), test: newBucket() };
  const byEra: Record<string, Bucket> = {};

  let i = 0;
  for (const building of data) {
    const { name, floors: floorCount, total_area_sqm, geojson } = building;
    const buildingType = building.buildingType ?? "office";
    const yearBuilt = building.year_built ?? building.yearBuilt ?? null;
    const market = building.market ?? "UK_RICS";
    const split = splitOf(i);
    const era = eraFromYear(yearBuilt);

    const geometry = geojson.type === "Feature" ? geojson.geometry : geojson;
    const footprintArea = turf.area(geometry);

    const footprintToken = await generateProvenanceToken("turf.area@1", [], { kind: "heuristic", ruleId: `ground-truth:${name}` });
    const footprintProv: ProvenancedValue = {
      value: footprintArea,
      unit: "m2",
      tier: "measured",
      method: "turf.area@1",
      inputs: [],
      token: footprintToken,
      confidence: 0.9,
      source: { kind: "satellite", fingerprint: { kind: "satellite", layer: "ground-truth", captureDate: null, gsd_m: null }, retrievedAt: new Date().toISOString() }
    };

    const floorToken = await generateProvenanceToken("ground-truth@1", [], { kind: "heuristic", ruleId: `ground-truth:${name}` });
    const floorsProv: ProvenancedValue = {
      value: floorCount,
      unit: "count",
      tier: "measured",
      method: "ground-truth@1",
      inputs: [],
      token: floorToken,
      confidence: 1.0,
      source: footprintProv.source
    };

    const { gia_m2 } = await deriveAreas(footprintProv, floorsProv, buildingType, { yearBuilt, market });

    const fallback = gia_m2.method.includes("era-fallback");
    const errorRatio = (gia_m2.value - total_area_sqm) / total_area_sqm;

    // accumulate
    const sb = bySplit[split];
    sb.errorSq += errorRatio * errorRatio; sb.count++; if (fallback) sb.fallback++;
    (byEra[era] ??= newBucket());
    byEra[era].errorSq += errorRatio * errorRatio; byEra[era].count++; if (fallback) byEra[era].fallback++;

    console.log(
      name.substring(0, 32).padEnd(33) + " | " +
      split.padEnd(6) + " | " +
      era.padEnd(11) + " | " +
      total_area_sqm.toString().padEnd(9) + " | " +
      Math.round(gia_m2.value).toString().padEnd(9) + " | " +
      (gia_m2.confidence ?? 0).toFixed(2).padEnd(6) + " | " +
      (errorRatio * 100).toFixed(1) + "%"
    );
    i++;
  }

  console.log("-".repeat(104));
  console.log("\n── RMSE by split (overfit check: train ≪ test ⇒ overfitting) ──");
  console.log(`  train: ${rmse(bySplit.train)}  (n=${bySplit.train.count})`);
  console.log(`  test:  ${rmse(bySplit.test)}  (n=${bySplit.test.count})`);

  console.log("\n── RMSE by era stratum ──");
  for (const era of ["pre1945", "1945_1980", "post1980", "unknown"]) {
    const b = byEra[era];
    if (b) console.log(`  ${era.padEnd(11)}: ${rmse(b).padEnd(8)} (n=${b.count}, era-fallback=${b.fallback})`);
  }

  const totalFallback = bySplit.train.fallback + bySplit.test.fallback;
  const totalCount = bySplit.train.count + bySplit.test.count;
  console.log(`\nEra-fallback used (no/implausible build year): ${totalFallback}/${totalCount}`);
  if (totalFallback === totalCount) {
    console.log("⚠  ALL rows hit era-fallback → stratification is NOT being exercised.");
    console.log("   Feed a domestic ground-truth set WITH build years (EPC) to actually test v2.");
  }
}

runReport().catch(console.error);
