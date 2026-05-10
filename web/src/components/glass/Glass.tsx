import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Glass — primitive surface for the entire UI.
 * Three intensity levels keep blur stacking in check (per ui-ux-pro-max
 * `effects-match-style`: never stack >2 glass layers — kills perf).
 *
 * Usage:
 *   <Glass intensity="strong" radius="lg">…</Glass>
 *   <Glass as="button" intensity="thin" interactive>Tap me</Glass>
 */
const glassVariants = cva(
  [
    "relative isolate",
    "ring-1 ring-[hsl(var(--ring-glass)/0.10)]",
    "border border-[hsl(var(--border-glass)/0.08)]",
    "text-[hsl(var(--foreground))]",
  ],
  {
    variants: {
      intensity: {
        thin: "bg-[hsl(var(--surface-glass-thin)/0.32)] backdrop-blur-md backdrop-saturate-150",
        base: "bg-[hsl(var(--surface-glass)/0.55)] backdrop-blur-xl backdrop-saturate-150",
        strong:
          "bg-[hsl(var(--surface-glass-strong)/0.72)] backdrop-blur-2xl backdrop-saturate-150",
      },
      radius: {
        none: "rounded-none",
        sm: "rounded-[var(--radius-sm)]",
        md: "rounded-[var(--radius-md)]",
        lg: "rounded-[var(--radius-lg)]",
        xl: "rounded-[var(--radius-xl)]",
        "2xl": "rounded-[var(--radius-2xl)]",
        full: "rounded-[var(--radius-full)]",
      },
      elevation: {
        none: "shadow-none",
        sm: "shadow-[var(--shadow-glass-sm)]",
        md: "shadow-[var(--shadow-glass-md)]",
        lg: "shadow-[var(--shadow-glass-lg)]",
      },
      interactive: {
        true: cn(
          "cursor-pointer select-none",
          "transition-[transform,background-color,box-shadow]",
          "duration-[var(--duration-fast)] ease-[var(--ease-out)]",
          "hover:bg-[hsl(var(--surface-glass)/0.65)]",
          "active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-accent))]",
        ),
        false: "",
      },
    },
    defaultVariants: {
      intensity: "base",
      radius: "lg",
      elevation: "md",
      interactive: false,
    },
  },
);

type GlassProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof glassVariants>;

export const Glass = forwardRef<HTMLDivElement, GlassProps>(function Glass(
  { className, intensity, radius, elevation, interactive, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        glassVariants({ intensity, radius, elevation, interactive }),
        className,
      )}
      {...props}
    />
  );
});

export { glassVariants };
export type { GlassProps };
