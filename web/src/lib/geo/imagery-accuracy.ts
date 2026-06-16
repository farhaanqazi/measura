/**
 * Defines the Ground Sample Distance (GSD) or resolution accuracy (in meters)
 * for known imagery basemaps. Used to compute geometric uncertainty.
 */
export const IMAGERY_ACCURACY_M: Record<string, number> = {
  // High-resolution aerial
  "mapbox-satellite": 0.5,
  "nearmap-vert": 0.15,
  
  // Standard satellite
  "google-satellite": 1.0,
  "sentinel-2": 10.0,
  
  // Default fallback if layer is unknown
  "unknown": 2.0,
};

export function getImageryAccuracy(layerId: string | null | undefined): number {
  if (!layerId) return IMAGERY_ACCURACY_M["unknown"]!;
  return IMAGERY_ACCURACY_M[layerId] ?? IMAGERY_ACCURACY_M["unknown"]!;
}
