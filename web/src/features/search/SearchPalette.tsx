"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useMap } from "@/features/map/MapContext";
import { useMapUI } from "@/features/map/store";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
}

const COORD_RE = /^\s*(-?\d{1,3}(?:\.\d+)?)[\s,]+(-?\d{1,3}(?:\.\d+)?)\s*$/;

async function fetchGeocode(q: string): Promise<NominatimResult[]> {
  if (q.trim().length < 2) return [];
  const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&limit=8`);
  if (!r.ok) throw new Error(`geocode ${r.status}`);
  const j = (await r.json()) as { results: NominatimResult[] };
  return j.results;
}

export function SearchPalette() {
  const open = useMapUI((s) => s.searchOpen);
  const setOpen = useMapUI((s) => s.setSearchOpen);
  const toggle = useMapUI((s) => s.toggleSearch);
  const { map } = useMap();

  const [q, setQ] = useState("");

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  // Detect "lat, lng" input and bypass the geocoder
  const coordMatch = q.match(COORD_RE);
  const directCoord = coordMatch
    ? { lat: parseFloat(coordMatch[1]!), lon: parseFloat(coordMatch[2]!) }
    : null;

  const { data, isFetching, isError } = useQuery({
    queryKey: ["geocode", q],
    queryFn: () => fetchGeocode(q),
    enabled: q.trim().length >= 2 && !directCoord,
    staleTime: 5 * 60 * 1000,
  });

  function flyToCoord(lat: number, lon: number) {
    if (!map) return;
    map.flyTo({ center: [lon, lat], zoom: 18, duration: 900 });
    setOpen(false);
    setQ("");
  }

  function flyTo(r: NominatimResult) {
    flyToCoord(parseFloat(r.lat), parseFloat(r.lon));
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Type an address, place, or coordinates"
      shouldFilter={false}
    >
      <CommandInput
        value={q}
        onValueChange={setQ}
        placeholder="Address, place, or 'lat, lng'…"
      />
      <CommandList className="min-h-[120px]">
        {/* Pre-input hint */}
        {q.trim().length < 2 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-[hsl(var(--muted-foreground))]">
            <Search className="size-5" />
            <p className="text-sm">Type at least 2 characters to search.</p>
            <p className="text-xs">
              Try: &ldquo;Eiffel Tower&rdquo;, &ldquo;Citywalk Mall Delhi&rdquo;,
              or &ldquo;40.7484, -73.9857&rdquo;
            </p>
          </div>
        )}

        {/* Direct coord input — fly there immediately */}
        {directCoord && (
          <CommandGroup heading="Coordinates">
            <CommandItem
              value={`coord-${directCoord.lat}-${directCoord.lon}`}
              onSelect={() => flyToCoord(directCoord.lat, directCoord.lon)}
              className="flex flex-col items-start gap-0.5"
            >
              <span className="text-sm">Fly to coordinates</span>
              <span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                {directCoord.lat.toFixed(5)}, {directCoord.lon.toFixed(5)}
              </span>
            </CommandItem>
          </CommandGroup>
        )}

        {/* Loading */}
        {q.trim().length >= 2 && !directCoord && isFetching && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[hsl(var(--muted-foreground))]">
            <Loader2 className="size-4 animate-spin" />
            Searching…
          </div>
        )}

        {/* Error */}
        {isError && !isFetching && (
          <CommandEmpty>
            Search failed. Check your connection and try again.
          </CommandEmpty>
        )}

        {/* No matches */}
        {q.trim().length >= 2 &&
          !directCoord &&
          !isFetching &&
          !isError &&
          data &&
          data.length === 0 && <CommandEmpty>No matches found.</CommandEmpty>}

        {/* Results */}
        {data && data.length > 0 && (
          <CommandGroup heading={`${data.length} result${data.length === 1 ? "" : "s"}`}>
            {data.map((r, i) => (
              <CommandItem
                key={`${i}-${r.place_id}-${r.lat}-${r.lon}`}
                value={`${r.display_name}-${i}-${r.place_id}`}
                onSelect={() => flyTo(r)}
                className="flex flex-col items-start gap-0.5"
              >
                <span className="text-sm">{r.display_name}</span>
                <span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                  {parseFloat(r.lat).toFixed(5)}, {parseFloat(r.lon).toFixed(5)}
                  {r.type ? ` · ${r.type}` : ""}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
