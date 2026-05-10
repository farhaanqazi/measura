"use client";

import { MousePointer2, Ruler, Square, Pentagon, Search } from "lucide-react";
import { Glass } from "@/components/glass/Glass";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useMapUI, type ToolMode } from "@/features/map/store";

const TOOLS: { id: ToolMode; label: string; icon: React.ReactNode; shortcut: string }[] = [
  { id: "select", label: "Select", icon: <MousePointer2 className="size-4" />, shortcut: "V" },
  { id: "ruler", label: "Ruler", icon: <Ruler className="size-4" />, shortcut: "R" },
  { id: "polygon", label: "Polygon", icon: <Pentagon className="size-4" />, shortcut: "P" },
  { id: "rectangle", label: "Rectangle", icon: <Square className="size-4" />, shortcut: "B" },
];

export function ToolSidebar() {
  const tool = useMapUI((s) => s.tool);
  const setTool = useMapUI((s) => s.setTool);
  const toggleSearch = useMapUI((s) => s.toggleSearch);

  return (
    <Glass intensity="strong" radius="2xl" elevation="lg" className="flex flex-col items-center gap-1 p-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggleSearch}
            className={cn(
              "flex size-10 items-center justify-center rounded-[var(--radius-lg)] text-[hsl(var(--muted-foreground))]",
              "hover:bg-[hsl(var(--surface-glass-thin)/0.4)] hover:text-[hsl(var(--foreground))]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-accent))]",
            )}
          >
            <Search className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          Search <Kbd>⌘K</Kbd>
        </TooltipContent>
      </Tooltip>

      <div className="my-1 h-px w-6 bg-[hsl(var(--border-glass)/0.10)]" />

      {TOOLS.map((t) => {
        const active = tool === t.id;
        return (
          <Tooltip key={t.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setTool(t.id)}
                className={cn(
                  "flex size-10 items-center justify-center rounded-[var(--radius-lg)] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-accent))]",
                  active
                    ? "bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]"
                    : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-glass-thin)/0.4)] hover:text-[hsl(var(--foreground))]",
                )}
              >
                {t.icon}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="flex items-center gap-2">
              {t.label} <Kbd>{t.shortcut}</Kbd>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </Glass>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-1 rounded-[var(--radius-xs)] border border-[hsl(var(--border-glass)/0.15)] bg-[hsl(var(--surface-glass-thin)/0.5)] px-1 py-0.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
      {children}
    </kbd>
  );
}
