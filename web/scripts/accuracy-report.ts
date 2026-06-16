import fs from 'fs';
import path from 'path';
import * as turf from '@turf/turf';
import { deriveAreas } from '../src/lib/geo/areas';
import { ProvenancedValue } from '../src/lib/provenance/types';
import { generateProvenanceToken } from '../src/lib/provenance/token';

if (!globalThis.crypto) {
  globalThis.crypto = require('crypto').webcrypto;
}

const DATASET_PATH = path.join(__dirname, '../test/ground-truth/dataset.json');

async function runReport() {
  const data = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
  let totalErrorSq = 0;
  let count = 0;

  console.log("=========================================");
  console.log("       MEASURA ACCURACY REPORT           ");
  console.log("=========================================\n");
  console.log("Building Name".padEnd(35) + " | " + "Ground Truth".padEnd(15) + " | " + "Derived GIA".padEnd(15) + " | " + "Error %");
  console.log("-".repeat(80));

  for (const building of data) {
    const { name, floors: floorCount, total_area_sqm, geojson } = building;

    // The dataset might have Polygon inside Geometry or Feature
    const geometry = geojson.type === "Feature" ? geojson.geometry : geojson;
    const footprintArea = turf.area(geometry);
    
    const footprintToken = await generateProvenanceToken("turf.area@1", [], { kind: "osm", id: name });
    const footprintProv: ProvenancedValue = {
      value: footprintArea,
      unit: "m2",
      tier: "measured",
      method: "turf.area@1",
      inputs: [],
      token: footprintToken,
      confidence: 0.9,
      source: { kind: "osm", fingerprint: { kind: "osm", elementType: "way", id: name, version: 1, timestamp: new Date().toISOString() }, retrievedAt: new Date().toISOString() }
    };

    const floorToken = await generateProvenanceToken("ground-truth@1", [], { kind: "osm", id: name });
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

    const { gia_m2 } = await deriveAreas(footprintProv, floorsProv, "office");

    const errorRatio = (gia_m2.value - total_area_sqm) / total_area_sqm;
    const errorPct = (errorRatio * 100).toFixed(1) + "%";
    
    totalErrorSq += errorRatio * errorRatio;
    count++;

    console.log(
      name.substring(0, 34).padEnd(35) + " | " +
      total_area_sqm.toString().padEnd(15) + " | " +
      Math.round(gia_m2.value).toString().padEnd(15) + " | " +
      errorPct
    );
  }

  const rmse = Math.sqrt(totalErrorSq / count);
  console.log("-".repeat(80));
  console.log(`Total Buildings Analyzed: ${count}`);
  console.log(`Root Mean Square Error (RMSE): ${(rmse * 100).toFixed(1)}%`);
  console.log("\nNote: The high error is expected here because 2D bounding boxes do not account for skyscraper tapering or setbacks.");
}

runReport().catch(console.error);
