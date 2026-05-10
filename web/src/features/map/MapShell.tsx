"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import maplibregl from "maplibre-gl";
import { MEASURA_STYLE, applyBaseLayer } from "./styles";
import { MapContextProvider } from "./MapContext";
import { useMapUI } from "./store";

interface MapShellProps {
  children?: ReactNode;
  initialCenter?: [number, number];
  initialZoom?: number;
}

/**
 * MapShell — full-bleed MapLibre canvas. UI overlays (search, tools,
 * measurement strip) render on top via `children` and absolute positioning.
 */
export function MapShell({
  children,
  initialCenter = [-73.9857, 40.7484], // Empire State Building (memorable demo)
  initialZoom = 16,
}: MapShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const baseLayer = useMapUI((s) => s.baseLayer);

  // Mount / unmount — strict-mode safe via active flag
  useEffect(() => {
    if (!containerRef.current) return;
    let active = true;

    const m = new maplibregl.Map({
      container: containerRef.current,
      style: MEASURA_STYLE,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: { compact: true },
      maxZoom: 19,
    });

    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    m.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      "bottom-right",
    );
    m.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");

    m.on("load", () => {
      if (!active) return;
      setMap(m);
    });
    m.on("error", (e) => {
      console.error("[MapLibre] error", e);
    });

    return () => {
      active = false;
      m.remove();
      setMap(null);
    };
    // initialCenter / initialZoom are intentionally only consumed on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactively swap base layer
  useEffect(() => {
    if (!map) return;
    applyBaseLayer(map, baseLayer);
  }, [map, baseLayer]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      <MapContextProvider value={{ map }}>{children}</MapContextProvider>
    </div>
  );
}
