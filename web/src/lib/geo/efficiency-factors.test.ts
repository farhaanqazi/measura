import { describe, it, expect } from "vitest";
import {
  EFFICIENCY_TABLES,
  LEGACY_FLAT_FACTOR_TABLE_VERSION,
  CURRENT_FACTOR_TABLE_VERSION,
  getEfficiencyFactors,
  eraFromYear,
  resolveEfficiencyFactors,
} from "./efficiency-factors";

// ── 1. ERA BUCKETING ─────────────────────────────────────────────────────────
describe("eraFromYear boundaries", () => {
  it("1944 → pre1945", () => expect(eraFromYear(1944)).toBe("pre1945"));
  it("1945 → 1945_1980 (inclusive lower)", () => expect(eraFromYear(1945)).toBe("1945_1980"));
  it("1980 → 1945_1980 (inclusive upper)", () => expect(eraFromYear(1980)).toBe("1945_1980"));
  it("1981 → post1980", () => expect(eraFromYear(1981)).toBe("post1980"));
  it("null → unknown", () => expect(eraFromYear(null)).toBe("unknown"));
  it("undefined → unknown", () => expect(eraFromYear(undefined)).toBe("unknown"));
  it("implausible future → unknown", () => expect(eraFromYear(3000)).toBe("unknown"));
  it("implausible past → unknown", () => expect(eraFromYear(1200)).toBe("unknown"));
  it("NaN → unknown", () => expect(eraFromYear(Number.NaN)).toBe("unknown"));
});

// ── 2. STRATIFIED RESOLUTION ─────────────────────────────────────────────────
describe("resolveEfficiencyFactors", () => {
  it("UK residential 1960 → 1945_1980 cell, default market, no fallback", () => {
    const r = resolveEfficiencyFactors({ buildingType: "residential", yearBuilt: 1960 });
    expect(r.market).toBe("UK_RICS");
    expect(r.era).toBe("1945_1980");
    expect(r.fallbackApplied).toBe(false);
    expect(r.nia_from_gia).toBe(0.85);
    expect(r.gia_from_gea).toBe(0.95);
    expect(r.confidence).toBe(0.7);
    expect(r.ruleId).toBe("efficiency_v2_2026Q2:UK_RICS:residential:1945_1980");
  });

  it("era differs by age: pre-1945 residential is less efficient than post-1980", () => {
    const old = resolveEfficiencyFactors({ buildingType: "residential", yearBuilt: 1900 });
    const recent = resolveEfficiencyFactors({ buildingType: "residential", yearBuilt: 2010 });
    expect(old.era).toBe("pre1945");
    expect(recent.era).toBe("post1980");
    expect(old.nia_from_gia).toBeLessThan(recent.nia_from_gia);
  });

  it("unknown era (no year) → post-1980 fallback with confidence penalty", () => {
    const r = resolveEfficiencyFactors({ buildingType: "residential", yearBuilt: null });
    expect(r.era).toBe("unknown");
    expect(r.fallbackApplied).toBe(true);
    // post1980 residential confidence 0.7 × 0.8 = 0.56
    expect(r.confidence).toBe(0.56);
    expect(r.ruleId).toContain("post1980(era-fallback)");
  });

  it("unknown building type → unknown row, confidence 0.3, factors 1.0", () => {
    const r = resolveEfficiencyFactors({ buildingType: "unknown", yearBuilt: 1990 });
    expect(r.buildingType).toBe("unknown");
    expect(r.gia_from_gea).toBe(1.0);
    expect(r.nia_from_gia).toBe(1.0);
    expect(r.confidence).toBe(0.3);
  });

  it("uncalibrated market (US_ANSI) degrades confidence, never throws", () => {
    const r = resolveEfficiencyFactors({
      buildingType: "residential",
      yearBuilt: 1990,
      market: "US_ANSI",
    });
    expect(r.market).toBe("US_ANSI");
    expect(r.confidence).toBe(0.3);
    expect(r.source).toContain("uncalibrated");
  });

  it("industrial is era-flat", () => {
    const a = resolveEfficiencyFactors({ buildingType: "industrial", yearBuilt: 1900 });
    const b = resolveEfficiencyFactors({ buildingType: "industrial", yearBuilt: 2020 });
    expect(a.nia_from_gia).toBe(b.nia_from_gia);
    expect(a.gia_from_gea).toBe(0.98);
  });

  it("throws on unknown version", () => {
    expect(() =>
      resolveEfficiencyFactors({ buildingType: "office", yearBuilt: 2000, version: "nope" })
    ).toThrow();
  });
});

// ── 3. v1 IMMUTABILITY + BACKWARD COMPATIBILITY ──────────────────────────────
describe("v1 flat table is frozen and still works", () => {
  it("v1 values are unchanged", () => {
    const v1 = EFFICIENCY_TABLES[LEGACY_FLAT_FACTOR_TABLE_VERSION];
    expect(v1.residential).toEqual({ gia_from_gea: 0.95, nia_from_gia: 0.85 });
    expect(v1.office).toEqual({ gia_from_gea: 0.95, nia_from_gia: 0.8 });
    expect(v1.industrial).toEqual({ gia_from_gea: 0.98, nia_from_gia: 0.95 });
    expect(v1.unknown).toEqual({ gia_from_gea: 1.0, nia_from_gia: 1.0 });
  });

  it("legacy getEfficiencyFactors() signature still resolves the flat table", () => {
    expect(getEfficiencyFactors("residential")).toEqual({ gia_from_gea: 0.95, nia_from_gia: 0.85 });
  });

  it("current default version pointer advanced to v2", () => {
    expect(CURRENT_FACTOR_TABLE_VERSION).toBe("efficiency_v2_2026Q2");
    expect(LEGACY_FLAT_FACTOR_TABLE_VERSION).toBe("efficiency_v1_2026Q2");
  });
});
