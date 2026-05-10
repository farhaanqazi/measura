"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MapShell } from "@/features/map/MapShell";
import { LayerSwitcher } from "@/features/map/LayerSwitcher";
import { SearchPalette } from "@/features/search/SearchPalette";
import { ToolSidebar } from "@/features/tools/ToolSidebar";
import { MeasurementStrip } from "@/features/measurement/MeasurementStrip";
import { BuildingDetailDrawer } from "@/features/measurement/BuildingDetailDrawer";
import { ThemeSwitcher } from "@/features/theme/ThemeSwitcher";
import { useBuildingDetection } from "@/features/measurement/useBuildingDetection";

export function Workspace() {
  return (
    <main className="relative h-[calc(100dvh-0px)] w-full overflow-hidden">
      <MapShell>
        {/* Side effects on map: building click → /api/buildings → polygon overlay */}
        <Listener />

        {/* Top-left: brand + back */}
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[hsl(var(--border-glass)/0.10)] bg-[hsl(var(--surface-glass-strong)/0.85)] px-3 text-xs font-medium text-[hsl(var(--muted-foreground))] backdrop-blur-xl shadow-[var(--shadow-glass-md)] transition-colors hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-accent))]"
          >
            <ArrowLeft className="size-3.5" />
            Measura
          </Link>
        </div>

        {/* Top-right: theme + layer */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <LayerSwitcher />
          <ThemeSwitcher />
        </div>

        {/* Left: vertical tool sidebar */}
        <div className="absolute left-4 top-1/2 z-10 -translate-y-1/2">
          <ToolSidebar />
        </div>

        {/* Bottom-center: live measurement readout */}
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
          <div className="pointer-events-auto">
            <MeasurementStrip />
          </div>
        </div>

        {/* Search palette (cmd+k) — overlays via Radix portal */}
        <SearchPalette />

        {/* Building detail drawer — slides in from right when a building is clicked */}
        <BuildingDetailDrawer />
      </MapShell>
    </main>
  );
}

function Listener() {
  useBuildingDetection();
  return null;
}
