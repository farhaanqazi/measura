import type { Position } from "geojson";
import { getImageryAccuracy } from "./imagery-accuracy";

/**
 * Computes the analytic uncertainty (1 standard deviation) of a polygon area
 * assuming independent Gaussian noise on each vertex coordinate.
 * 
 * Variance of Area = (sigma^2 / 2) * sum( (x_{i+1} - x_{i-1})^2 + (y_{i+1} - y_{i-1})^2 )
 * 
 * Note: Coordinates must be projected into a metric system (e.g., Web Mercator or local UTM) 
 * before passing to this function. For raw lng/lat, distances must be computed geodesically,
 * but for this simplified MVP we assume x,y are in meters.
 */
export function calculateAnalyticAreaUncertainty(
  projectedRingMeters: [number, number][],
  layerId: string | null
): number {
  const n = projectedRingMeters.length;
  if (n < 4) return 0; // Invalid ring

  const sigma = getImageryAccuracy(layerId);
  let sumSq = 0;

  // Assumes the first and last vertex are the same (closed ring)
  // We iterate over the unique vertices: 0 to n-2.
  for (let i = 0; i < n - 1; i++) {
    const prev = projectedRingMeters[(i - 1 + (n - 1)) % (n - 1)]!;
    const next = projectedRingMeters[(i + 1) % (n - 1)]!;
    
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    
    sumSq += dx * dx + dy * dy;
  }

  const variance = (sigma * sigma / 2.0) * sumSq;
  return Math.sqrt(variance);
}

/**
 * Combines geometry uncertainty and floor count uncertainty in quadrature
 * to yield the absolute uncertainty of a derived area (like GEA, GIA, NIA).
 */
export function combineAreaUncertainty(
  baseAreaM2: number,
  baseUncertaintyM2: number,
  floors: number,
  floorUncertainty: number
): number {
  if (baseAreaM2 <= 0 || floors <= 0) return 0;

  const relAreaError = baseUncertaintyM2 / baseAreaM2;
  const relFloorError = floorUncertainty / floors;

  const combinedRelError = Math.sqrt(relAreaError * relAreaError + relFloorError * relFloorError);
  
  return combinedRelError * (baseAreaM2 * floors);
}
