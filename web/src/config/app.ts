export const APP_CONFIG = {
  name: "Measura",
  tagline: "Measure any building, anywhere.",
  description:
    "Locate buildings on satellite imagery and measure their footprint, dimensions, and surrounding distances. Real estate, construction, insurance, and GIS in one tool.",
  defaultMapCenter: { lng: 0, lat: 20, zoom: 2 } as const,
  measurementUnits: ["metric", "imperial"] as const,
} as const;

export type MeasurementUnit = (typeof APP_CONFIG.measurementUnits)[number];
