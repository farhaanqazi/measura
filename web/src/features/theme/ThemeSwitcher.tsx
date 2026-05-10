"use client";

import { useTheme } from "next-themes";
import { Palette, Check } from "lucide-react";
import { Glass } from "@/components/glass/Glass";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const THEMES = [
  {
    id: "sleek-pro",
    label: "Sleek Pro",
    sub: "Deep slate · Electric cyan",
    swatch: ["#0a0d12", "#22d3ee"],
  },
  {
    id: "editorial-lux",
    label: "Editorial Lux",
    sub: "Warm midnight · Soft amber",
    swatch: ["#101427", "#f59e0b"],
  },
  {
    id: "high-contrast-field",
    label: "High-Contrast Field",
    sub: "Pure black · Neon cyan",
    swatch: ["#000000", "#00d4ff"],
  },
] as const;

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  // SSR-safe: theme is undefined on the server; no item highlights until hydrated,
  // which is fine since the popover content isn't rendered until user opens it.

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full",
            "bg-[hsl(var(--surface-glass)/0.55)] backdrop-blur-xl",
            "border border-[hsl(var(--border-glass)/0.10)]",
            "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
            "shadow-[var(--shadow-glass-md)] transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-accent))]",
          )}
          aria-label="Theme"
        >
          <Palette className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-72 border-[hsl(var(--border-glass)/0.10)] bg-[hsl(var(--surface-glass-strong)/0.85)] p-2 backdrop-blur-2xl"
      >
        <Glass intensity="thin" radius="md" elevation="none" className="border-0 p-0 shadow-none">
          <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            Glass mood
          </div>
          {THEMES.map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-left transition-colors",
                  active ? "bg-[hsl(var(--accent)/0.12)]" : "hover:bg-[hsl(var(--surface-glass-thin)/0.4)]",
                )}
              >
                <div className="flex shrink-0 items-center gap-1">
                  <span
                    className="size-4 rounded-full ring-1 ring-white/20"
                    style={{ background: t.swatch[0] }}
                  />
                  <span
                    className="size-4 rounded-full ring-1 ring-white/20"
                    style={{ background: t.swatch[1] }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{t.sub}</div>
                </div>
                {active && <Check className="size-4 text-[hsl(var(--accent))]" />}
              </button>
            );
          })}
        </Glass>
      </PopoverContent>
    </Popover>
  );
}
