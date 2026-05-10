"use client";

import { Layers, Satellite, Map as MapIcon } from "lucide-react";
import { Glass } from "@/components/glass/Glass";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useMapUI } from "./store";
import type { BaseLayer } from "./styles";

const LAYERS: { id: BaseLayer; label: string; icon: React.ReactNode }[] = [
  { id: "satellite", label: "Satellite", icon: <Satellite className="size-4" /> },
  { id: "streets", label: "Streets", icon: <MapIcon className="size-4" /> },
];

export function LayerSwitcher() {
  const baseLayer = useMapUI((s) => s.baseLayer);
  const setBaseLayer = useMapUI((s) => s.setBaseLayer);

  return (
    <Glass intensity="strong" radius="xl" elevation="md" className="flex items-center gap-1 p-1">
      <div className="px-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        <Layers className="inline size-3 -mt-0.5 mr-1" />
        Layer
      </div>
      {LAYERS.map((l) => (
        <Tooltip key={l.id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-pressed={baseLayer === l.id}
              onClick={() => setBaseLayer(l.id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-accent))]",
                baseLayer === l.id
                  ? "bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-glass-thin)/0.4)] hover:text-[hsl(var(--foreground))]",
              )}
            >
              {l.icon}
              <span className="hidden sm:inline">{l.label}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{l.label}</TooltipContent>
        </Tooltip>
      ))}
    </Glass>
  );
}
