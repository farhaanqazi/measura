"use client";

import { Building2, ChevronUp, Loader2, Ruler, Square, Compass, X } from "lucide-react";
import { Glass } from "@/components/glass/Glass";
import { formatArea, formatLength } from "@/lib/geo/measurements";
import { useMapUI, type SelectedBuilding, type DrawnFeature } from "@/features/map/store";
import { cn } from "@/lib/utils";

export function MeasurementStrip() {
  const drawnFeature = useMapUI((s) => s.drawnFeature);
  const selected = useMapUI((s) => s.selected);
  const detecting = useMapUI((s) => s.detecting);
  const unit = useMapUI((s) => s.unit);
  const setUnit = useMapUI((s) => s.setUnit);
  const setDetailOpen = useMapUI((s) => s.setDetailOpen);
  const tool = useMapUI((s) => s.tool);

  const setDrawnFeature = useMapUI((s) => s.setDrawnFeature);
  const setSelected = useMapUI((s) => s.setSelected);

  if (detecting && !selected) {
    return (
      <Glass intensity="strong" radius="full" elevation="md" className="flex items-center gap-2 px-4 py-2 text-sm">
        <Loader2 className="size-4 animate-spin text-[hsl(var(--accent))]" />
        Detecting building footprint…
      </Glass>
    );
  }

  const activeFeature = (tool !== "select" && drawnFeature) ? drawnFeature : selected;

  if (!activeFeature) {
    return (
      <Glass
        intensity="thin"
        radius="full"
        elevation="sm"
        className="flex items-center gap-2 px-4 py-2 text-xs text-[hsl(var(--muted-foreground))]"
      >
        <Building2 className="size-3.5" />
        {tool === "select" 
          ? "Click a building to auto-detect its footprint and measurements."
          : "Click on the map to start drawing and measuring."}
      </Glass>
    );
  }

  const p = activeFeature.properties as Partial<SelectedBuilding["properties"]> &
    Partial<NonNullable<DrawnFeature["properties"]>>;
  const tagsName = p?.tags?.["name"] || p?.tags?.["addr:housename"] || (tool !== "select" ? "Custom Measurement" : "Building");

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        className="group focus-visible:outline-none"
        aria-label="Open details"
      >
        <Glass
          intensity="strong"
          radius="2xl"
          elevation="lg"
          data-tabular
          className={cn(
            "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition-all",
            "group-hover:bg-[hsl(var(--surface-glass-strong)/0.85)]",
            "group-focus-visible:ring-2 group-focus-visible:ring-[hsl(var(--ring-accent))]",
          )}
        >
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-[hsl(var(--accent))]" />
            <span className="text-sm font-medium">{tagsName}</span>
          </div>

          <Sep />

          {p.area_m2 !== undefined && (
            <Stat icon={<Square className="size-3.5" />} label="Area" value={formatArea(p.area_m2, unit)} />
          )}
          {p.perimeter_m !== undefined && (
            <Stat icon={<Ruler className="size-3.5" />} label="Perimeter" value={formatLength(p.perimeter_m, unit)} />
          )}
          {p.length_m !== undefined && (
            <Stat icon={<Ruler className="size-3.5" />} label="Length" value={formatLength(p.length_m, unit)} />
          )}
          {p.bbox_width_m !== undefined && p.bbox_length_m !== undefined && (
            <Stat
              icon={<Compass className="size-3.5" />}
              label="Bbox"
              value={`${formatLength(p.bbox_width_m, unit)} × ${formatLength(p.bbox_length_m, unit)}`}
            />
          )}

          <Sep />

          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              setUnit(unit === "metric" ? "imperial" : "metric");
            }}
            className="rounded-full border border-[hsl(var(--border-glass)/0.15)] bg-[hsl(var(--surface-glass-thin)/0.4)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            {unit}
          </span>

          <ChevronUp className="size-3.5 text-[hsl(var(--muted-foreground))] transition-transform group-hover:-translate-y-0.5 group-hover:text-[hsl(var(--accent))]" />
        </Glass>
      </button>

      <button
        type="button"
        aria-label="Clear measurement"
        onClick={() => {
          setSelected(null);
          setDrawnFeature(null);
        }}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--surface-glass-strong))] text-[hsl(var(--muted-foreground))] shadow-sm backdrop-blur-md transition-all hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive))]"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[hsl(var(--muted-foreground))]">{icon}</span>
      <span className="text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

function Sep() {
  return <div className="hidden h-4 w-px bg-[hsl(var(--border-glass)/0.15)] sm:block" />;
}
