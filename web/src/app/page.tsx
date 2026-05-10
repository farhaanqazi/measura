import Link from "next/link";
import { ArrowRight, Ruler, MapPinned, Boxes, Sparkles } from "lucide-react";
import { Glass } from "@/components/glass/Glass";
import { GlassPill } from "@/components/glass/GlassPill";
import { APP_CONFIG } from "@/config/app";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      {/* Backdrop — radial glow placeholder until the live map is wired in */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_-20%,hsl(var(--cyan-500)/0.18),transparent_60%),radial-gradient(80%_60%_at_80%_100%,hsl(var(--cyan-700)/0.18),transparent_60%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,transparent,hsl(var(--background)))]"
      />

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-10 px-6 py-24 text-center sm:py-32">
        <GlassPill className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          <Sparkles className="size-3.5 text-[hsl(var(--accent))]" />
          {APP_CONFIG.name} · v0.1 alpha
        </GlassPill>

        <div className="space-y-6">
          <h1 className="text-balance bg-gradient-to-b from-[hsl(var(--foreground))] to-[hsl(var(--muted-foreground))] bg-clip-text text-5xl font-semibold leading-[1.05] tracking-tight text-transparent sm:text-7xl">
            {APP_CONFIG.tagline}
          </h1>
          <p className="mx-auto max-w-2xl text-balance text-base text-[hsl(var(--muted-foreground))] sm:text-lg">
            {APP_CONFIG.description}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/app"
            className="group inline-flex items-center gap-2 rounded-full bg-[hsl(var(--accent))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--accent-foreground))] shadow-[var(--shadow-glass-md)] transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-[hsl(var(--accent-strong))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-accent))]"
          >
            Open the workspace
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/api/health"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            System status
          </Link>
        </div>

        <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          <Feature
            icon={<MapPinned className="size-5 text-[hsl(var(--accent))]" />}
            title="Locate any building"
            body="Address search, lat/lng, or click. OSM footprints render instantly over satellite imagery."
          />
          <Feature
            icon={<Ruler className="size-5 text-[hsl(var(--accent))]" />}
            title="Measure everything"
            body="Auto area & perimeter, manual distance, setbacks, and bearing — pure-client geodesic math."
          />
          <Feature
            icon={<Boxes className="size-5 text-[hsl(var(--accent))]" />}
            title="Local-first, cloud-ready"
            body="Works offline. Syncs to Postgres + PostGIS when you sign in. Export GeoJSON, KML, CSV."
          />
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-6 py-8 text-xs text-[hsl(var(--muted-foreground))]">
        <p>
          Powered by OpenStreetMap, MapLibre GL, Turf.js, and free satellite
          imagery. Building footprints © OpenStreetMap contributors.
        </p>
      </footer>
    </main>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Glass intensity="base" radius="xl" elevation="md" className="p-5 text-left">
      <div className="mb-3 inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] bg-[hsl(var(--surface-glass-thin)/0.5)]">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{title}</h3>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{body}</p>
    </Glass>
  );
}
