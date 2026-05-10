"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUp,
  Building2,
  Compass,
  Copy,
  ExternalLink,
  Layers,
  MapPin,
  Mountain,
  Ruler,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatArea, formatLength } from "@/lib/geo/measurements";
import { inferBuildingHeight } from "@/lib/geo/height";
import { useMapUI } from "@/features/map/store";
import { cn } from "@/lib/utils";

const HIDDEN_TAG_PREFIXES = ["source:", "ref:"];

export function BuildingDetailDrawer() {
  const open = useMapUI((s) => s.detailOpen);
  const setOpen = useMapUI((s) => s.setDetailOpen);
  const selected = useMapUI((s) => s.selected);
  const unit = useMapUI((s) => s.unit);
  const setUnit = useMapUI((s) => s.setUnit);

  const tagGroups = useMemo(() => groupTags(selected?.properties.tags), [selected]);
  const height = useMemo(
    () => inferBuildingHeight(selected?.properties.tags),
    [selected],
  );

  // Fetch ground elevation for the building's centroid
  const centroidKey = selected
    ? `${selected.properties.centroid[0]}-${selected.properties.centroid[1]}`
    : null;
  const { data: elevationData } = useQuery({
    queryKey: ["elevation", centroidKey],
    queryFn: async () => {
      if (!selected) return null;
      const [lng, lat] = selected.properties.centroid;
      const r = await fetch(`/api/elevation?lat=${lat}&lng=${lng}`);
      if (!r.ok) return null;
      const j = (await r.json()) as { elevation_m: number | null };
      return j.elevation_m;
    },
    enabled: Boolean(selected) && open,
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  if (!selected) return null;
  const p = selected.properties;
  const name =
    p.tags?.["name"] ||
    p.tags?.["addr:housename"] ||
    p.tags?.["building"] ||
    "Unnamed building";

  const osmUrl =
    p.osm_id && p.osm_type
      ? `https://www.openstreetmap.org/${p.osm_type}/${p.osm_id}`
      : null;

  const copyGeoJSON = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(selected, null, 2));
      toast.success("GeoJSON copied to clipboard");
    } catch {
      toast.error("Could not copy — clipboard blocked");
    }
  };

  const copyCoords = async () => {
    const [lng, lat] = p.centroid;
    try {
      await navigator.clipboard.writeText(`${lat.toFixed(7)}, ${lng.toFixed(7)}`);
      toast.success("Coordinates copied");
    } catch {
      toast.error("Could not copy — clipboard blocked");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-[hsl(var(--border-glass)/0.10)] bg-[hsl(var(--surface-glass-strong)/0.92)] p-0 backdrop-blur-2xl sm:max-w-md"
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <SheetHeader className="border-b border-[hsl(var(--border-glass)/0.08)] p-5 pr-12">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]">
              <Building2 className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-base">{name}</SheetTitle>
              <SheetDescription className="text-xs">
                {p.tags?.["building"] && p.tags?.["building"] !== "yes"
                  ? `Type: ${p.tags["building"]}`
                  : "OpenStreetMap building"}
                {osmUrl && (
                  <>
                    {" · "}
                    <a
                      href={osmUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[hsl(var(--accent))] hover:underline"
                    >
                      OSM <ExternalLink className="size-3" />
                    </a>
                  </>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-5" data-tabular>
            {/* ── Measurements ─────────────────────────────── */}
            <Section title="Measurements" right={<UnitToggle unit={unit} onChange={setUnit} />}>
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  icon={<Square className="size-3.5" />}
                  label="Area"
                  value={formatArea(p.area_m2, unit)}
                />
                <Stat
                  icon={<Ruler className="size-3.5" />}
                  label="Perimeter"
                  value={formatLength(p.perimeter_m, unit)}
                />
                <Stat
                  icon={<Compass className="size-3.5" />}
                  label="Bbox width"
                  value={formatLength(p.bbox_width_m, unit)}
                />
                <Stat
                  icon={<Compass className="size-3.5 rotate-90" />}
                  label="Bbox length"
                  value={formatLength(p.bbox_length_m, unit)}
                />
              </div>
            </Section>

            <Separator />

            {/* ── Height & Elevation ───────────────────────── */}
            <Section title="Height & elevation">
              {height ? (
                <div className="space-y-2">
                  <Stat
                    icon={<ArrowUp className="size-3.5" />}
                    label={
                      height.source === "osm-height"
                        ? "Height (OSM exact)"
                        : "Height (from floors)"
                    }
                    value={formatLength(height.meters, unit)}
                  />
                  {height.levels != null && (
                    <Stat
                      icon={<Layers className="size-3.5" />}
                      label="Floors"
                      value={String(height.levels)}
                    />
                  )}
                </div>
              ) : (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  No height tagged in OSM for this building.{" "}
                  <a
                    href="https://wiki.openstreetmap.org/wiki/Key:height"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[hsl(var(--accent))] hover:underline"
                  >
                    Learn how to add it
                  </a>
                  .
                </p>
              )}

              {elevationData != null && (
                <div className="space-y-2">
                  <Stat
                    icon={<Mountain className="size-3.5" />}
                    label="Ground above sea level"
                    value={formatLength(elevationData, unit)}
                  />
                  {height && (
                    <Stat
                      icon={<ArrowUp className="size-3.5" />}
                      label="Roof above sea level"
                      value={formatLength(elevationData + height.meters, unit)}
                    />
                  )}
                </div>
              )}
            </Section>

            <Separator />

            {/* ── Location ─────────────────────────────────── */}
            <Section title="Location">
              <button
                type="button"
                onClick={copyCoords}
                className={cn(
                  "group flex w-full items-center justify-between rounded-[var(--radius-md)]",
                  "bg-[hsl(var(--surface-glass-thin)/0.4)] px-3 py-2 text-left",
                  "transition-colors hover:bg-[hsl(var(--surface-glass-thin)/0.6)]",
                )}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="size-3.5 text-[hsl(var(--muted-foreground))]" />
                  <span className="font-mono text-xs">
                    {p.centroid[1].toFixed(6)}, {p.centroid[0].toFixed(6)}
                  </span>
                </div>
                <Copy className="size-3.5 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100" />
              </button>

              {addressLine(p.tags) && (
                <div className="rounded-[var(--radius-md)] bg-[hsl(var(--surface-glass-thin)/0.4)] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {addressLine(p.tags)}
                </div>
              )}
            </Section>

            {/* ── Tag groups ────────────────────────────────── */}
            {tagGroups.map((group) => (
              <div key={group.title}>
                <Separator />
                <Section title={group.title}>
                  <dl className="space-y-1.5 text-xs">
                    {group.entries.map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-3">
                        <dt className="text-[hsl(var(--muted-foreground))]">{k}</dt>
                        <dd className="min-w-0 flex-1 truncate text-right font-mono">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Section>
              </div>
            ))}

            {tagGroups.length === 0 && (
              <>
                <Separator />
                <Section title="OSM tags">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    No additional tags on this building.
                  </p>
                </Section>
              </>
            )}
          </div>
        </ScrollArea>

        {/* ── Footer actions ─────────────────────────────────── */}
        <div className="flex items-center gap-2 border-t border-[hsl(var(--border-glass)/0.08)] bg-[hsl(var(--surface-glass-strong)/0.6)] p-3">
          <button
            type="button"
            onClick={copyGeoJSON}
            className="flex-1 inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[hsl(var(--surface-glass-thin)/0.5)] px-3 text-xs font-medium hover:bg-[hsl(var(--surface-glass-thin)/0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-accent))]"
          >
            <Layers className="size-3.5" />
            Copy GeoJSON
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-md)] px-3 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <X className="size-3.5" />
            Close
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── helpers ──────────────────────────────────────────────────── */

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[hsl(var(--surface-glass-thin)/0.4)] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}

function UnitToggle({
  unit,
  onChange,
}: {
  unit: "metric" | "imperial";
  onChange: (u: "metric" | "imperial") => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(unit === "metric" ? "imperial" : "metric")}
      className="rounded-full border border-[hsl(var(--border-glass)/0.15)] bg-[hsl(var(--surface-glass-thin)/0.4)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
    >
      {unit}
    </button>
  );
}

function addressLine(tags: Record<string, string | undefined> | undefined) {
  if (!tags) return null;
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:city"] || tags["addr:suburb"],
    tags["addr:state"],
    tags["addr:postcode"],
    tags["addr:country"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

interface TagGroup {
  title: string;
  entries: [string, string][];
}

function groupTags(tags: Record<string, string | undefined> | undefined): TagGroup[] {
  if (!tags) return [];

  const groups: Record<string, [string, string][]> = {
    Building: [],
    Address: [],
    Identification: [],
    Other: [],
  };

  for (const [k, v] of Object.entries(tags)) {
    if (!v) continue;
    if (HIDDEN_TAG_PREFIXES.some((p) => k.startsWith(p))) continue;
    if (k === "name" || k === "building" || k.startsWith("addr:")) continue; // already shown above

    if (
      k === "building:levels" ||
      k === "building:height" ||
      k === "height" ||
      k === "start_date" ||
      k === "architect" ||
      k.startsWith("roof:") ||
      k.startsWith("building:")
    ) {
      groups["Building"]!.push([k, v]);
    } else if (
      k === "wikipedia" ||
      k === "wikidata" ||
      k === "ref" ||
      k.startsWith("name:")
    ) {
      groups["Identification"]!.push([k, v]);
    } else {
      groups["Other"]!.push([k, v]);
    }
  }

  return Object.entries(groups)
    .filter(([, e]) => e.length > 0)
    .map(([title, entries]) => ({ title, entries: entries.sort() }));
}
