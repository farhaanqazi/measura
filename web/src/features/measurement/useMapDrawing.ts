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

    // The "change" event fires on every pointer move while drawing. Computing
    // stats + updating the store on each one floods the main thread and stalls
    // the tool after a few vertices. So: coalesce to at most one update per
    // animation frame, skip not-yet-valid geometry, and never let an error
    // bubble into terra-draw's event loop (which corrupts its pointer state).
    let rafId: number | null = null;
    const handleChange = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        try {
          const snapshot = draw.getSnapshot();
          if (snapshot.length === 0) {
            setDrawnFeature(null);
            return;
          }

          const latest = snapshot[snapshot.length - 1];
          if (!latest) return;

          const geomType = latest.geometry.type;
          if (geomType === "Polygon") {
            const ring = (latest.geometry as Polygon).coordinates?.[0];
            if (!ring || ring.length < 4) return; // not yet a closed ring
            const stats = polygonStats(latest as Feature<Polygon>);
            setDrawnFeature({
              ...latest,
              properties: { ...latest.properties, ...stats },
            } as unknown as DrawnFeature);
          } else if (geomType === "LineString") {
            const coords = (latest.geometry as LineString).coordinates;
            if (!coords || coords.length < 2) return;
            const stats = lineStats(latest as Feature<LineString>);
            setDrawnFeature({
              ...latest,
              properties: { ...latest.properties, ...stats },
            } as unknown as DrawnFeature);
          } else {
            setDrawnFeature(latest as unknown as DrawnFeature);
          }
        } catch (err) {
          console.warn("[useMapDrawing] change handler error:", err);
        }
      });
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
      if (rafId !== null) cancelAnimationFrame(rafId);
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
