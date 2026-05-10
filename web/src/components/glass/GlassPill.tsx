import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Glass } from "./Glass";

type GlassPillProps = HTMLAttributes<HTMLDivElement> & {
  /** Use tabular-nums for shifting values (measurements, coordinates). */
  tabular?: boolean;
};

export const GlassPill = forwardRef<HTMLDivElement, GlassPillProps>(
  function GlassPill({ className, tabular, ...props }, ref) {
    return (
      <Glass
        ref={ref}
        intensity="thin"
        radius="full"
        elevation="sm"
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 text-sm",
          tabular && "font-mono [font-variant-numeric:tabular-nums]",
          className,
        )}
        {...props}
      />
    );
  },
);
