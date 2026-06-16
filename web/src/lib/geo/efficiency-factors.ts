export const CURRENT_FACTOR_TABLE_VERSION = "efficiency_v1_2026Q2";

export type BuildingType = "office" | "residential" | "retail" | "industrial" | "unknown";

interface EfficiencyFactor {
  gia_from_gea: number;
  nia_from_gia: number;
}

/**
 * Immutable, versioned table of efficiency factors.
 * Once published, a version is never edited.
 */
export const EFFICIENCY_TABLES: Record<string, Record<BuildingType, EfficiencyFactor>> = {
  efficiency_v1_2026Q2: {
    office: { gia_from_gea: 0.95, nia_from_gia: 0.80 },
    residential: { gia_from_gea: 0.95, nia_from_gia: 0.85 },
    retail: { gia_from_gea: 0.95, nia_from_gia: 0.90 },
    industrial: { gia_from_gea: 0.98, nia_from_gia: 0.95 },
    unknown: { gia_from_gea: 1.0, nia_from_gia: 1.0 }, // Fallback, heavily penalized in confidence
  },
};

export function getEfficiencyFactors(
  buildingType: BuildingType,
  version: string = CURRENT_FACTOR_TABLE_VERSION
): EfficiencyFactor {
  const table = EFFICIENCY_TABLES[version];
  if (!table) throw new Error(`Unknown factor table version: ${version}`);
  return table[buildingType] || table["unknown"];
}
