"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@/features/map/MapContext";
import { useMapUI } from "@/features/map/store";
import { polygonStats, lineStats } from "@/lib/geo/measurements";
import { logMeasurement, geomSummary } from "@/lib/devlog";
import type { Feature, Polygon, LineString } from "geojson";
import type { DrawnFeature } from "@/features/map/store";

// We import these dynamically or assume they are exported like this:
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawLineStringMode,
  TerraDrawSelectMode,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";

export function useMapDrawing() {
  const { map } = useMap();
  const tool = useMapUI((s) => s.tool);
  const setDrawnFeature = useMapUI((s) => s.setDrawnFeature);
  const setDetailOpen = useMapUI((s) => s.setDetailOpen);
  
  const drawRef = useRef<TerraDraw | null>(null);

  // Initialize TerraDraw
  useEffect(() => {
    if (!map) return;

    const adapter = new TerraDrawMapLibreGLAdapter({ map });
    
    const draw = new TerraDraw({
      adapter,
      modes: [
        new TerraDrawSelectMode({
          flags: {
            polygon: {
              feature: {
                draggable: true,
                coordinates: {
                  midpoints: true,
                  draggable: true,
                  deletable: true,
                },
              },
            },
            linestring: {
              feature: {
                draggable: true,
                coordinates: {
                  midpoints: true,
                  draggable: true,
                  deletable: true,
                },
              },
            },
            rectangle: {
              feature: {
                draggable: true,
                coordinates: {
                  draggable: true,
                  deletable: true,
                },
              },
            },
          },
        }),
        new TerraDrawPolygonMode(),
        new TerraDrawRectangleMode(),
        new TerraDrawLineStringMode(),
      ],
    });

    draw.start();
    drawRef.current = draw;

    const handleChange = () => {
      // Whenever a feature is updated or created, update the store
      const snapshot = draw.getSnapshot();
      // We only care about the most recently modified or selected feature
      // For simplicity, let's grab the last feature in the snapshot.
      if (snapshot.length === 0) {
        setDrawnFeature(null);
        return;
      }
      
      const latest = snapshot[snapshot.length - 1];
      if (!latest) return;
      
      const geomType = latest.geometry.type;
      if (geomType === "Polygon") {
        const stats = polygonStats(latest as Feature<Polygon>);
        setDrawnFeature({
          ...latest,
          properties: { ...latest.properties, ...stats }
        } as unknown as DrawnFeature);
      } else if (geomType === "LineString") {
        const stats = lineStats(latest as Feature<LineString>);
        setDrawnFeature({
          ...latest,
          properties: { ...latest.properties, ...stats }
        } as unknown as DrawnFeature);
      } else {
        setDrawnFeature(latest as unknown as DrawnFeature);
      }
    };

    const handleFinish = () => {
      const snapshot = draw.getSnapshot();
      const latest = snapshot[snapshot.length - 1];
      if (!latest) return;
      const geomType = latest.geometry.type;
      if (geomType === "Polygon") {
        const stats = polygonStats(latest as Feature<Polygon>);
        logMeasurement({
          source: "manual-polygon",
          ...geomSummary(latest as unknown as Feature<Polygon>),
          ...stats,
          geometry: latest.geometry,
        });
      } else if (geomType === "LineString") {
        const stats = lineStats(latest as Feature<LineString>);
        logMeasurement({
          source: "manual-ruler",
          ...geomSummary(latest as unknown as Feature<LineString>),
          length_m: stats.length_m,
          bearing_deg: stats.bearing_deg,
          geometry: latest.geometry,
        });
      }
      // Surface the detail drawer for manual measurements too (not just select).
      setDetailOpen(true);
    };

    draw.on("change", handleChange);
    draw.on("finish", handleChange);
    draw.on("finish", handleFinish);
    draw.on("select", handleChange);

    return () => {
      try {
        draw.stop();
      } catch (e) {
        console.warn("TerraDraw stop error:", e);
      }
      drawRef.current = null;
    };
  }, [map, setDrawnFeature, setDetailOpen]);

  // Sync tool with store
  useEffect(() => {
    if (!drawRef.current) return;
    const draw = drawRef.current;

    if (tool === "select") {
      draw.setMode("select");
    } else if (tool === "polygon") {
      draw.setMode("polygon");
    } else if (tool === "rectangle") {
      draw.setMode("rectangle");
    } else if (tool === "ruler") {
      draw.setMode("linestring");
    }
  }, [tool]);

  const drawnFeature = useMapUI((s) => s.drawnFeature);
  
  // Clear TerraDraw when drawnFeature is null
  useEffect(() => {
    if (!drawnFeature && drawRef.current) {
      drawRef.current.clear();
    }
  }, [drawnFeature]);
}
