"use client";

import { createContext, useContext, type ReactNode } from "react";
import type maplibregl from "maplibre-gl";

type MapContextValue = {
  map: maplibregl.Map | null;
};

const MapContext = createContext<MapContextValue | null>(null);

export function MapContextProvider({
  value,
  children,
}: {
  value: MapContextValue;
  children: ReactNode;
}) {
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMap() {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error("useMap() must be used inside <MapShell>.");
  return ctx;
}
