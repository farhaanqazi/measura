/**
 * Building height inference from OSM tags.
 *
 * OSM has no single canonical "height" tag — different mappers use different
 * conventions. This module normalizes the most common ones into a single
 * `BuildingHeight` value with a confidence/source label.
 *
 * Tag precedence (most reliable first):
 *   1. `height`              — explicit meters (or "X ft")
 *   2. `building:height`     — same as above, alternative tag
 *   3. `building:levels`     — number of stories; multiply by 3.0 m as a
 *                              well-accepted average for residential/office.
 *   4. `roof:levels`         — added on top of `building:levels` when present.
 */

const M_PER_FT = 0.3048;
const M_PER_LEVEL = 3.0;

export interface BuildingHeight {
  /** Estimated total height of the building in meters. */
  meters: number;
  /** How confident we are: "exact" (from tag), "estimated" (from level count). */
  source: "osm-height" | "osm-levels" | "osm-mixed";
  /** Optional details for the UI. */
  levels?: number;
  rawHeightTag?: string;
}

export function inferBuildingHeight(
  tags: Record<string, string | undefined> | undefined,
): BuildingHeight | null {
  if (!tags) return null;

  // 1. Explicit `height` (or `building:height`) tag
  const rawHeight = tags["height"] ?? tags["building:height"];
  if (rawHeight) {
    const parsed = parseHeightString(rawHeight);
    if (parsed != null) {
      const lv = parseInt(tags["building:levels"] ?? "", 10);
      return {
        meters: parsed,
        source: "osm-height",
        levels: Number.isFinite(lv) ? lv : undefined,
        rawHeightTag: rawHeight,
      };
    }
  }

  // 2. Levels — building:levels (+ roof:levels if both present)
  const buildingLevels = parseInt(tags["building:levels"] ?? "", 10);
  const roofLevels = parseInt(tags["roof:levels"] ?? "", 10);
  if (Number.isFinite(buildingLevels)) {
    const totalLevels =
      buildingLevels + (Number.isFinite(roofLevels) ? roofLevels : 0);
    return {
      meters: totalLevels * M_PER_LEVEL,
      source: Number.isFinite(roofLevels) ? "osm-mixed" : "osm-levels",
      levels: totalLevels,
    };
  }

  return null;
}

/** Parse OSM height strings like "73", "73 m", "240 ft", "73.5". */
function parseHeightString(s: string): number | null {
  const trimmed = s.trim().toLowerCase();
  // "240 ft" or "240ft"
  const ftMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*(?:ft|')$/);
  if (ftMatch) return parseFloat(ftMatch[1]!) * M_PER_FT;
  // "73 m" or "73m" or just "73"
  const mMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*m?$/);
  if (mMatch) return parseFloat(mMatch[1]!);
  return null;
}
