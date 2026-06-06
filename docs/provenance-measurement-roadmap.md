# Measura — Provenance-Validated Measurement Roadmap

> Plan doc (rev 2 — incorporates critical review). No code written yet. Mapped against the actual codebase as of branch `main` (commit `b04ed49`).
> **Customer context:** the consumer is an **AVM company** (automated valuation models for banks/insurers doing *desktop* valuation — no on-site surveyor). The AVM is currently a **target persona, not a signed customer**, so the intake contract below is an *assumed, revisable* spec — not a gate on building. The product is **machine-readable, confidence-scored, provenance-tagged measurement data**. A human-readable PDF is secondary.

---

## 0. Guiding principle (added rev 2)

**No number ships that we cannot empirically defend.** The architecture (tiers, provenance, RICS mapping) is necessary but not sufficient — it makes numbers *traceable*, not *correct*. Correctness is established by **Phase 0 ground-truth validation**, which gates everything else. If we cannot show calibrated accuracy on real buildings, the elegant provenance graph is just well-documented error.

---

## 1. The core reframe

A property valuation model turns a building measurement into a dollar figure. That means:

1. **Area error propagates into money.** A ±8% area error can be a ±8% valuation error. So the deliverable is an area **with an uncertainty bound** the AVM can weight by.
2. **You cannot measure interior/usable area from overhead imagery.** What you measure is the **roof/footprint outline**. Everything else is *derived* (× floors) or *estimated* (× efficiency). The provenance model keeps these honest and separable.
3. **Banks reason in standardized area terms** (RICS / IPMS). Emitting raw `area_m2` is not enough — the AVM needs to know *which* standardized area each number represents.
4. **The dominant error term is floor count, not geometry.** (See §3.) Geometry uncertainty is ~single-digit %; a one-floor miscount on a 4-storey building is a 25% GFA error. Effort allocation must reflect this.

### The three provenance tiers (the spine)

| Tier | Meaning | Example | How produced |
|------|---------|---------|--------------|
| `measured` | Direct geometric computation on a real polygon | Footprint 412 m² | Turf `area()` on traced/OSM ring |
| `derived` | Deterministic formula over measured + sourced inputs | GFA 1,648 m² | footprint × 4 floors (floors from OSM tag) |
| `estimated` | Heuristic / model-proposed factor | Carpet ≈ 1,320 m² | GFA × 0.80 efficiency |

Every emitted number carries its tier + a confidence. The output validator (§7) **rejects any number whose provenance chain doesn't resolve** and falls back to a logged heuristic.

---

## 2. Industry-standard area model (the spec)

Map every area to **RICS / IPMS** vocabulary:

| Measura field | Standard term | Definition | Typical tier | Use |
|---------------|---------------|------------|--------------|-----|
| `footprint_m2` | — (roof outline) | Exterior outline at roof | `measured` | Base geometry |
| `gea_m2` | **GEA** / **IPMS 1** | Outline × floors, incl. external walls | `derived` | Insurance reinstatement |
| `gia_m2` | **GIA** / **IPMS 2** | GEA minus external wall thickness | `derived`/`estimated` | Commercial valuation |
| `nia_m2` | **NIA** / **IPMS 3** / "carpet" | Usable area, excl. walls/cores/common | `estimated` | Residential valuation / RERA carpet |

References for code comments: RICS *Code of Measuring Practice* (GEA/GIA/NIA), IPMS (1/2/3). For statutory carpet markets (India RERA), `nia_m2` maps to RERA carpet area.

### 2.1 Efficiency factors — versioned & immutable (rev 2)

- Factors live in `web/src/lib/geo/efficiency-factors.ts` as a **named, immutable, versioned table**: `efficiency_v1_2026Q2` etc. Once published, a version is never edited.
- Changing a factor = publishing a **new version**. Past records keep their original version id in provenance; they are **not retroactively recomputed** (immutability — see §6).
- Each `MeasurementRecord` records the exact `factorTableVersion` used.
- Factors are **building-type and market dependent**, not global constants. Ownership: Measura publishes a default table; a future config layer lets a customer override per-market.
- **Unknown building type ⇒ degrade, don't guess:** if type can't be sourced/proposed with confidence, emit `nia_m2` with `confidence ≤ 0.5` and `tier: "estimated"`, or omit it entirely (configurable). Never emit a confident NIA on an assumed type.

---

## 3. Floor count — the dominant error term (rev 2, new)

GEA/GIA/NIA all hinge on floor count. We treat it as a first-class, sourced value with a strict hierarchy (mirrors the precedence already in [height.ts](web/src/lib/geo/height.ts)):

| Priority | Source | Tier | Confidence | Notes |
|----------|--------|------|-----------|-------|
| 1 | OSM `building:levels` (+`roof:levels`) | `derived` (sourced) | high (~0.9) | Explicit human tag — best available without survey |
| 2 | Height ÷ floor-to-floor, with explicit assumed spacing | `estimated` | medium (~0.6) | Spacing is type-dependent: residential ~2.9 m, office ~3.7 m. **Record the assumed spacing in provenance.** |
| 3 | LLM proposal from imagery (shadows/façade) | `estimated` | low (~0.4), **penalized** | Only when 1 & 2 unavailable. Subject to false-mansard / ornamental-roof / mixed-use error. |

Rules:
- Floor count is **always** emitted with its source + (for priority 2/3) the assumed floor-to-floor spacing logged.
- Mixed-use / non-uniform floors, false mansards, lofts: flagged as edge cases (§9) → confidence penalty or refusal.
- Floor-count uncertainty (e.g. ±0.5 floor) is a **separate uncertainty channel** from geometry and combines with it in §4.

---

## 4. Uncertainty model — concrete (rev 2)

Two independent channels, combined in quadrature on the **relative** error of each derived area:

1. **Geometry uncertainty (footprint).** Default method: **analytic shoelace error propagation** from per-vertex positional σ. Per-vertex σ is **imagery-source-dependent**, not a fixed ±1 m:
   - Set σ from the active imagery layer's known GSD/registration (e.g. ~0.5 m for high-res aerial, ~5 m for coarse satellite). Stored in a small `imagery-accuracy.ts` table keyed by layer.
   - Monte-Carlo vertex jitter is implemented **only as an offline cross-check** of the analytic formula, not in the hot path.
2. **Floor-count uncertainty** (§3): ±n floors → relative error on GEA/GIA/NIA.
3. **Systematic terms vertex-jitter cannot catch** (called out explicitly):
   - **Roof-vs-ground parallax:** footprint from imagery is the *roof* outline; for tall buildings this diverges from the ground footprint. Flag when `height` is large; optionally apply a lean correction if view geometry is known.
   - **Georegistration bias:** a whole-polygon translational offset in the tile source. Documented as a known residual; not removed by jitter.

`uncertainty` on each `ProvenancedValue` is the combined ½-CI. Calibration of these bounds is **verified in Phase 0** (do "0.92 confidence" outputs really have <8% error?).

---

## 5. The provenance record (TypeScript shape)

Generalizes the `BuildingHeight.source` pattern from [height.ts](web/src/lib/geo/height.ts).

```ts
// web/src/lib/provenance/types.ts  (NEW)

export type ProvenanceTier = "measured" | "derived" | "estimated";

export interface ProvenancedValue {
  value: number;
  unit: "m2" | "m" | "count" | "ratio";
  tier: ProvenanceTier;
  method: string;            // stable id, e.g. "turf.area@1", "gea=footprint*floors@1"
  inputs: string[];          // ids of upstream ProvenancedValues
  token: string;             // see §6 — sha256 over canonical(method, inputs, sourceFingerprint)
  uncertainty?: number;      // ± half-width of CI, same unit (§4)
  confidence?: number;       // 0..1, calibrated in Phase 0
  source: ProvenanceSource;
}

export interface ProvenanceSource {
  kind: "osm" | "user-drawn" | "satellite" | "llm" | "heuristic";
  fingerprint: SourceFingerprint;   // explicit, not a magic hash (§6)
  retrievedAt: string;              // ISO; passed in, never Date.now() in pure fns
}

/** Explicit, serializable provenance of raw inputs. */
export type SourceFingerprint =
  | { kind: "osm"; elementType: "way" | "relation"; id: number; version: number | null; timestamp: string | null }
  | { kind: "satellite"; layer: string; captureDate: string | null; gsd_m: number | null }
  | { kind: "llm"; model: string; promptVersion: string }
  | { kind: "user-drawn"; sessionId: string }
  | { kind: "heuristic"; ruleId: string };

export interface MeasurementRecord {
  footprint_m2: ProvenancedValue;
  floors?: ProvenancedValue;
  gea_m2?: ProvenancedValue;
  gia_m2?: ProvenancedValue;
  nia_m2?: ProvenancedValue;
  height_m?: ProvenancedValue;     // wraps existing inferBuildingHeight()
  perimeter_m?: ProvenancedValue;
  pipelineVersion: string;         // algorithm/version stamp
  factorTableVersion: string;      // §2.1
  inputFingerprint: string;        // hash of geometry + params
}
```

Stored in the existing `Measurement.feature.properties.provenance` — **no new Supabase table for Phases 0–7**; `measurements.properties jsonb` already exists ([0001_init.sql:50](web/supabase/migrations/0001_init.sql#L50)). A dedicated `measurement_provenance` table is only for Phase 8 (signing), if at all.

---

## 6. Provenance token — exact spec (rev 2)

- **Algorithm:** SHA-256 (not SHA-1).
- **Input:** RFC 8785-style **canonical JSON** of `{ method, inputs (sorted), sourceFingerprint }`. Deterministic key order, no whitespace, normalized numbers.
- **`sourceFingerprint`:** the explicit `SourceFingerprint` union above — never an opaque pre-hash. Missing OSM `version` ⇒ `null` (recorded as such; lowers confidence, does not throw).
- **Immutability:** a token, once emitted, is **never retroactively invalidated**. If upstream OSM is later edited, that is a *new* measurement with a *new* token — the old record remains a faithful record of what was known at `retrievedAt`. The AVM treats a superseded token as "re-measure available," not "wrong."
- **Methodology versioning:** changing how tokens/areas are computed bumps `pipelineVersion`; old records are read with their original version. No silent recompute.
- "Resolve a token" (§7) = recompute the canonical hash from the record's own declared `method`+`inputs`+`fingerprint` and check it equals the stored `token`, **and** that every id in `inputs` resolves transitively to a `measured` root. A chain that bottoms out in nothing measured cannot resolve.

---

## 7. Output validator — as code, not prose (rev 2)

Defined in `web/src/lib/provenance/validator.ts` as executable rules, e.g.:

```ts
// Pseudocode of the rule set — real impl is typed + unit-tested.
function validate(v: ProvenancedValue, graph: RecordGraph): Verdict {
  if (!tokenResolves(v, graph)) return reject(v, "token-unresolved");
  if (!chainReachesMeasuredRoot(v, graph)) return reject(v, "no-measured-root");
  if (v.tier === "estimated" && (v.confidence ?? 0) < 0.5) return reject(v, "low-confidence-estimate");
  if (contradictsCrossSource(v, graph)) return reject(v, "source-conflict"); // e.g. LLM floors vs height-implied floors
  return accept(v);
}
```

On `reject`, the field falls back to a **documented per-field heuristic** and is re-tagged `tier: "estimated", source.kind: "heuristic"` with the `ruleId` of the fallback and the **rejection reason logged** for audit. Examples:
- `nia_m2` rejected ⇒ fall back to `gia_m2 × market-median-efficiency(buildingType)`.
- `floors` cross-source conflict ⇒ prefer the higher-priority source (§3) and log the discarded one.

Thresholds (`0.5`, etc.) live in one config object so they are tunable from Phase 0 calibration, not scattered magic numbers.

---

## 8. Phased plan (mapped to real files)

### Phase 0 — Ground-truth validation harness *(NEW — gates everything)*
**Goal:** be able to *measure our own accuracy* before building the pipeline that produces numbers.

- Assemble **≥50 ground-truth buildings** with known floor count, type, and (where possible) published GEA/GIA/NIA — landmark specs, cadastral/RERA filings, municipal records, or buildings the user can verify.
- **New:** `web/test/ground-truth/` dataset (GeoJSON + expected values + source citation per building) and a `scripts/accuracy-report.ts` harness that runs the pipeline and reports error distributions + **confidence calibration**.
- **Accuracy targets (initial, revisable):** footprint within ±5% in 80% of cases; GEA within ±10%; NIA within ±15%; and calibration — stated confidence buckets match observed error rates.
- **Deliverable:** a reproducible accuracy report. **No Phase 1 merge without a green baseline.**

### Phase 1 — Provenance core + measurement tiering
- **New:** `web/src/lib/provenance/types.ts` (§5), `token.ts` (§6, takes `retrievedAt` param, no ambient clock), `validator.ts` (§7).
- **Edit:** [measurements.ts](web/src/lib/geo/measurements.ts) — wrap `polygonStats` output in `ProvenancedValue`s (footprint = `measured`). Keep pure functions; add `toMeasurementRecord()` adapter.
- **Edit:** [height.ts](web/src/lib/geo/height.ts) — adapt `BuildingHeight.source` → `ProvenanceSource`.
- **Edit:** [store.ts](web/src/features/map/store.ts) — extend property types with `record?: MeasurementRecord`.
- **Edit:** [buildings/route.ts](web/src/app/api/buildings/route.ts) — `out geom meta 30` to capture OSM `version`/`timestamp` into the fingerprint.

### Phase 2 — Standards-mapped area derivation + floor-count hierarchy
- **New:** `web/src/lib/geo/areas.ts` (`deriveAreas`), `efficiency-factors.ts` (§2.1, versioned), `floors.ts` (§3 hierarchy).
- **Edit:** [BuildingDetailDrawer.tsx](web/src/features/measurement/BuildingDetailDrawer.tsx), [MeasurementStrip.tsx](web/src/features/measurement/MeasurementStrip.tsx) — show GEA/GIA/NIA each with a **tier badge** (Measured/Derived/Estimated).

### Phase 3 — Uncertainty model (§4)
- **New:** `web/src/lib/geo/uncertainty.ts` (analytic shoelace + quadrature with floor-count channel), `imagery-accuracy.ts` (per-layer σ). Monte-Carlo cross-check lives in `web/test/`.
- **Deliverable:** `412 ± 9 m²` in UI; systematic flags (parallax/bias) surfaced.

### Phase 4 — Provenance-validated AI layer
- **New:** `web/src/app/api/propose/route.ts` — Claude **Haiku 4.5** proposes *only inputs* (floor count, building type, efficiency hint), never a final area. **Read the claude-api skill first** (prompt caching, structured tool output).
  - **Operational spec (rev 2):** hard timeout (~5 s) → fall back to heuristic; structured tool-output schema for proposals (typed, validated); **input sanitization** (strip image metadata, no untrusted text reaches the prompt — guards prompt injection); **every proposal logged** for audit/calibration.
- Validator (§7) gates all output. Backend (Turf/`areas.ts`) does all arithmetic.

### Phase 5 — Machine-readable export (the actual AVM product)
- **New:** `web/src/app/api/export/[id]/route.ts` — full `MeasurementRecord` as **JSON** + an **OpenAPI** doc. This is the primary deliverable.
- CSV flattening is **nice-to-have, deferred** (nested provenance flattens poorly; AVM wants JSON).
- **Secondary:** human-readable PDF (use the `pdf` skill).

### Phase 6 — Operational / intake contract (assumed, revisable) *(rev 2)*
**Goal:** design to a concrete intake spec without blocking on a signed customer.
- Document an **assumed contract**: REST + JSON, batch + webhook delivery, idempotent record ids, a **recompute/dispute endpoint** (field adjuster finds NIA ≠ estimate → request re-measure, producing a new token per §6), and a target SLA. Mark every assumption as revisable when a real customer engages.
- **Deliverable:** `docs/intake-contract.md` + OpenAPI — a negotiating artifact, not a gate.

### Phase 7 — Edge-case decision tree *(rev 2)*
Document explicit handling (refuse or penalize, never silently emit) for: roofed parking (footprint ≠ usable), atriums/pavilions, under-construction structures, hillside/split-level (ambiguous footprint), false mansards. Lives in `floors.ts` / `areas.ts` guards + `docs/edge-cases.md`.

### Phase 8 — Cryptographic signing + audit trail *(deferred, future)*
Framing locked: **provenance integrity, not legal certification.** Ed25519 over canonicalized `MeasurementRecord` + timestamp; export carries a "not a survey" disclaimer. Optional `measurement_provenance` table only if an immutable audit log is required. Build only after 0–5 are proven in production.

---

## 9. Sequencing & rationale

**Phase 0 gates all.** Then 1→2→3→4→5 in dependency order (can't validate what you can't tier/derive/bound; export is meaningful only once the record is trustworthy). Phases 6 & 7 run in parallel with 2–5 as documentation. Phase 8 deferred.

**Open inputs before coding (rev 2):**
1. **Ground-truth sourcing:** can the user supply / point to ≥50 buildings with known floor count + area? (Phase 0 blocker — this is the real prerequisite, not the customer contract.)
2. **Imagery layer + GSD:** which base layer, and its known resolution/registration accuracy? (Drives §4 σ. Will read `web/src/features/map/styles.ts` if not provided.)
3. **Market + building-type taxonomy:** RICS commercial vs RERA residential carpet — drives §2.1 factor table.

**What is *not* a blocker (rev 2):** a signed AVM customer / final API contract. We design to an assumed contract (Phase 6) and revise on engagement.
