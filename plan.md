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

## Efficiency v2 — Stratified Factor Engine (type × era × market)

Replaces the flat per-type efficiency factor with a stratified, versioned, confidence-tagged table. v1 is frozen and untouched (immutability); v2 is the new default methodology. Anchored on UK_RICS; US_ANSI and IN_RERA are registered but degrade as uncalibrated until Phase-0 calibration. Scope decided 2026-06-17.

| Step | Baby Step | Status | Location | How to implement |
| :--- | :--- | :---: | :--- | :--- |
| **V2.1** | Add `Market`, `Era`, `StratifiedFactor` types + `eraFromYear` bucketing | ✅ Complete | `web/src/lib/geo/efficiency-factors.ts` | Inclusive-lower boundaries: 1945→`1945_1980`, 1980→`1945_1980`, 1981→`post1980`; null/implausible→`unknown`. |
| **V2.2** | Seed `STRATIFIED_EFFICIENCY_TABLES` v2 (UK_RICS full; US/IN placeholders) | ✅ Complete | `web/src/lib/geo/efficiency-factors.ts` | UK seeded from RICS CoMP, confidence ≤0.7. Placeholders `source:"uncalibrated:awaiting-phase0"`, confidence 0.3. Immutable. |
| **V2.3** | Implement `resolveEfficiencyFactors()` with degrade-don't-throw fallbacks | ✅ Complete | `web/src/lib/geo/efficiency-factors.ts` | Unknown era → post-1980 cell × 0.8 confidence + `fallbackApplied`. Unknown type → `unknown` row. Uncalibrated market → degraded confidence, never throws. Returns `ruleId`. |
| **V2.4** | Bump default version pointer to v2; keep v1 flat lookup working | ✅ Complete | `web/src/lib/geo/efficiency-factors.ts` | `CURRENT_FACTOR_TABLE_VERSION="efficiency_v2_2026Q2"`; `getEfficiencyFactors()` defaults to `LEGACY_FLAT_FACTOR_TABLE_VERSION`. |
| **V2.5** | Wire resolver into `deriveAreas` with heuristic provenance + ruleId | ✅ Complete | `web/src/lib/geo/areas.ts` | GIA/NIA `tier:"estimated"`, `source.kind:"heuristic"`, fingerprint `ruleId`, confidence absorbs factor + fallback penalty. New `DeriveAreasOptions { yearBuilt, market, factorVersion }`. |
| **V2.6** | Stamp new exports with current factor version | ✅ Complete | `web/src/app/api/export/[id]/route.ts` | Use `CURRENT_FACTOR_TABLE_VERSION` instead of hardcoded v1 string. |
| **V2.7** | Unit tests (eras, fallback, unknowns, immutability, backward compat) | ✅ Complete | `web/src/lib/geo/efficiency-factors.test.ts` | Vitest; covers boundaries, US placeholder degradation, v1 frozen values, legacy signature. |
| **V2.8** | Extend accuracy harness to consume year/type/market + report fallback | ✅ Complete | `web/scripts/accuracy-report.ts` | Reads optional `buildingType`/`year_built`/`market` per row; prints confidence + era-fallback count. |
| **V2.9** | Ground-truth fetch script (UK EPC register) | ⚠️ Superseded — targets retired API | `web/scripts/fetch-ground-truth.ts` | Written for the OLD EPC API (retired 30 May 2026). Header documents the new API spec; rewrite tracked as V2.10c. |
| **V2.10a** | Auto-pull footprints + storeys for EPC rows (geocode → OSM) | ✅ Tooling ready | `web/scripts/enrich-footprints.ts` | Geocodes each EPC address (Nominatim) → nearest OSM building polygon → `building:levels`. Flags match distance/confidence; excludes unmatched/no-storey rows. Needs network run. |
| **V2.10b** | Deterministic train/test split + per-era RMSE in harness | ✅ Complete | `web/scripts/accuracy-report.ts` | 80/20 hold-out (every 5th row = test), RMSE by split + by era, `--dataset`/`--split off` flags, warns when 100% era-fallback. |
| **V2.10c** | Rewrite `fetch-ground-truth` for the NEW EPC API (Bearer auth, `council[]` filter, search→`/api/certificate` detail) | ⏳ Pending | `web/scripts/fetch-ground-truth.ts` | Old API retired 30 May 2026. London-first: filter to boroughs (Camden/Islington), sample ~300–500, pull `total_floor_area`+`uprn`. No 6 GB national bulk needed. |
| **V2.10d** | Source construction era (EPC purged age band) via Colouring London + OSM `start_date` | ⏳ Pending | new `web/scripts/*` | Join age by UPRN/location; missing → existing era-fallback. London = best UK age coverage. |
| **V2.10e** | Run London fetch→enrich→score with train/test split; recalibrate strata as NEW version if factors change | ⏳ Pending | `web/test/ground-truth/` | `accuracy-report --dataset dataset.london.json`. Go/no-go: per-era residential error beats flat v1 on held-out set? |
| **V2.10f** | `.env.local` auto-loader for standalone scripts | ✅ Complete | `web/scripts/load-env.ts` | tsx doesn't auto-load `.env.local`; loader sets unset keys without printing values. |
| **V2.11** | UI: show era + market alongside tier badge on GIA/NIA | ⏳ Pending | `BuildingDetailDrawer.tsx`, `MeasurementStrip.tsx` | Render `Estimated · UK_RICS · 1945–1980 · conf 0.70`; use `Glass` primitive, ≤2 layers. |
| **V2.12** | Promote US_ANSI / IN_RERA from placeholder to calibrated | ⏳ Pending | `web/src/lib/geo/efficiency-factors.ts` | Only after market-specific ground truth hits accuracy targets; publish as new version. |

### EPC data reality & London-first calibration (decided 2026-06-17)

- **Old EPC API retired 30 May 2026.** `epc.opendatacommunities.org/api/...` now 301-redirects (auth stripped → HTML) to the new GOV.UK service. Verified live.
- **New API:** base `https://api.get-energy-performance-data.communities.gov.uk`. Auth `Authorization: Bearer <EPC_API_KEY>` (no email). Search `/api/domestic/search?council[]=<NAME>&page_size=&current_page=` → `{ data:[{ certificateNumber, uprn, addressLine1.. }], pagination }`. Detail `/api/certificate?certificate_number=<n>` → `{ data:{ total_floor_area, habitable_room_count, property_type(int code), built_form(int code), floors(=construction info, NOT storeys), ... } }`.
- **Construction age band PURGED** (Home Energy Model framework dropped it as an input). `total_floor_area` remains (good ground truth); build year does not. Era must come from another source.
- **London-first decision:** use search+detail API filtered to London boroughs (sample ~300–500, ~0 GB) instead of the 5.9 GB national bulk. Source era from **Colouring London** (+ OSM `start_date`); footprints/storeys from OSM (best UK coverage in London). Confirmed borough filters work by name (Camden 101,886 / Islington 105,020 / Westminster 130,715 domestic EPCs).
- **Env wiring:** `EPC_EMAIL`/`EPC_API_KEY` added to `.env.example` (gitignored locally) + `env.ts` schema with `isEpcConfigured()`. Real key lives only in gitignored `.env.local`.
- **National bulk (only if scaling beyond London later):** `GET /api/files/domestic/csv` (Bearer, follows 302→S3 zip), live ~5.9 GB zip / ~40–55 GB unzipped; `/api/files/domestic/csv/info` reports size. Slim-extract needed columns with DuckDB (already a dependency). Verify the bulk CSV still carries an age column before relying on it.
