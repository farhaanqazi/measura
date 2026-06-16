# Measura Implementation Plan

This plan breaks down the `provenance-measurement-roadmap.md` into actionable baby steps, tracks completion status, and provides step-by-step instructions on how to implement the pending items.

## Execution Checklist

| Phase | Baby Step | Status | Location | How to implement (Baby steps) |
| :--- | :--- | :---: | :--- | :--- |
| **Phase 0** | Collect dataset of ≥50 ground-truth buildings | ✅ Complete | `web/test/ground-truth/` | 1. Find 50 real-world buildings with known, verifiable floor counts and total areas. <br> 2. Draw their GeoJSON polygons. <br> 3. Save as JSON array with citations. |
| | Create accuracy report harness | ✅ Complete | `scripts/accuracy-report.ts` | 1. Write a script to loop over the 50 buildings in the test dataset. <br> 2. Run the pipeline logic against each. <br> 3. Compare output with expected values and log standard deviation & error rates. |
| **Phase 1** | Create provenance type definitions | ✅ Complete | `web/src/lib/provenance/types.ts` | Implemented `ProvenancedValue` and `ProvenanceSource`. |
| | Implement SHA-256 token generation | ✅ Complete | `web/src/lib/provenance/token.ts` | Implemented `generateProvenanceToken()` using Web Crypto API. |
| | Create output validator rules & heuristics fallback logic | ✅ Complete | `web/src/lib/provenance/validator.ts` | 1. Create `validate(v, graph)` function. <br> 2. Implement check to ensure token resolves via SHA-256 validation. <br> 3. Check for source conflicts. <br> 4. Assign fallback heuristics on rejection. |
| | Wrap polygon stats in `ProvenancedValue` adapter | ✅ Complete | `web/src/lib/geo/measurements.ts` | 1. Modify `polygonStats` export or wrap it to map `area_m2` to a `ProvenancedValue` object with `tier: "measured"`. <br> 2. Await the token generation. |
| | Adapt `BuildingHeight.source` to use `ProvenanceSource` | ✅ Complete | `web/src/lib/geo/height.ts` | 1. Update `BuildingHeight` to match the new `ProvenanceSource` schema. <br> 2. Refactor `inferBuildingHeight` to return the updated format. |
| | Update OSM Overpass query to capture version/timestamp | ✅ Complete | `web/src/app/api/buildings/route.ts` | 1. Modify the Overpass QL query string: change `out geom` to `out geom meta 30`. <br> 2. Update types to parse OSM element versions. |
| **Phase 2** | Create versioned efficiency factor tables | ✅ Complete | `web/src/lib/geo/efficiency-factors.ts` | Implemented immutable `EFFICIENCY_TABLES`. |
| | Implement floor count hierarchy logic | ✅ Complete | `web/src/lib/geo/floors.ts` | 1. Export `deriveFloors(osmData, heightData, aiProposal)`. <br> 2. Check OSM tags first. <br> 3. Fallback to `height / assumedSpacing`. <br> 4. Fallback to AI. |
| | Implement deterministic RICS area derivations | ✅ Complete | `web/src/lib/geo/areas.ts` | 1. Export `deriveAreas(footprint, floors, type)`. <br> 2. GEA = footprint * floors. <br> 3. GIA = GEA * efficiency. <br> 4. Return `ProvenancedValue` for each. |
| | Update UI to display GEA/GIA/NIA with tier badges | ⏳ Pending | `BuildingDetailDrawer.tsx` | 1. Update the React component to expect `ProvenancedValue`. <br> 2. Render small badges (`Measured`, `Derived`, `Estimated`) next to the values. |
| **Phase 3** | Create per-layer GSD/accuracy configuration | ✅ Complete | `web/src/lib/geo/imagery-accuracy.ts` | 1. Create a `Map<LayerID, number>` defining resolution accuracy for basemaps. |
| | Implement analytic shoelace uncertainty | ✅ Complete | `web/src/lib/geo/uncertainty.ts` | 1. Write the analytic formula propagating vertex jitter into area error. <br> 2. Add floor-count uncertainty in quadrature. |
| **Phase 4** | Create Claude API route for proposals | ✅ Complete | `web/src/app/api/propose/route.ts` | 1. Setup a Next.js API route integrating Anthropic SDK. <br> 2. Implement Haiku 4.5 prompt with structured JSON tool output. <br> 3. Add a 5s AbortSignal timeout. |
| **Phase 5** | Create JSON export endpoint | ✅ Complete | `web/src/app/api/export/[id]/route.ts` | 1. Setup a GET route taking measurement ID. <br> 2. Return the full `MeasurementRecord` json payload. |
| **Phase 6/7**| Document Intake Contracts & Edge Cases | ✅ Complete | `docs/` | 1. Draft `intake-contract.md` describing webhook logic. <br> 2. Draft `edge-cases.md` detailing rule exclusions for parking lots & split levels. |
| **Phase 8** | Implement Ed25519 signing (Deferred) | ⏳ Pending | Backend | 1. Create keypair. <br> 2. Sign canonicalized payload on final export. |
