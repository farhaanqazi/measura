"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getQueryClient } from "@/lib/query-client";

/**
 * Top-level client providers. Wired into the root layout once.
 * Order matters:
 *   ThemeProvider (no-flash + data-theme attribute)
 *     → QueryClientProvider (cross-cutting server-state)
 *       → app
 *         → Toaster (renders into a portal at body)
 */
export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="sleek-pro"
      themes={["sleek-pro", "editorial-lux", "high-contrast-field"]}
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={250}>
          {children}
          <Toaster
            position="top-right"
            theme="dark"
            toastOptions={{
              classNames: {
                toast:
                  "!bg-[hsl(var(--surface-glass-strong)/0.85)] !backdrop-blur-xl !border !border-[hsl(var(--border-glass)/0.10)]",
              },
            }}
          />
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
