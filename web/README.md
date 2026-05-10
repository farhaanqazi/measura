# Measura

> Measure any building, anywhere. Locate buildings on satellite imagery and measure their footprint, dimensions, and surrounding distances. Real estate, construction, insurance, and GIS in one tool.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, React 19) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + three-layer design tokens |
| UI | shadcn/ui (Radix primitives) + custom Glass primitives |
| Map | MapLibre GL JS |
| Drawing | terra-draw |
| Geo math | Turf.js |
| State (server) | TanStack Query |
| State (client) | Zustand |
| Forms | react-hook-form + Zod |
| Local storage | Dexie (IndexedDB), repository pattern |
| Cloud sync | Supabase (Postgres + PostGIS + Auth + Storage) |
| Env | `@t3-oss/env-nextjs` + Zod (typed, validated at boot) |

## Architecture

Local-first, sync-second:

```
UI (Server + Client Components)
  → Repository interface
    → DexieRepository  (IndexedDB, source of truth, offline-capable)
      → SyncEngine     (background push/pull to Supabase)
        → Supabase     (Postgres + PostGIS + RLS + Auth)
```

The map UI floats glass panels over a full-bleed MapLibre canvas. Server-side
Route Handlers proxy Nominatim (geocoding) and Overpass (building footprints)
so we respect their fair-use policies and add CDN caching.

## Project structure

```
web/
├── src/
│   ├── app/
│   │   ├── api/                Route handlers (geocode, buildings, health)
│   │   ├── app/                Workspace (map UI — Phase 2)
│   │   ├── globals.css         Tailwind v4 entry + token bridge
│   │   ├── layout.tsx          Root layout + Providers
│   │   └── page.tsx            Landing
│   ├── components/
│   │   ├── glass/              Glass / GlassPill primitives
│   │   ├── ui/                 shadcn/ui (added on demand)
│   │   └── providers.tsx       Query + Theme + Toaster
│   ├── config/
│   │   └── app.ts              App-wide constants
│   ├── lib/
│   │   ├── env.ts              Validated env (typed)
│   │   ├── utils.ts            cn() helper
│   │   ├── query-client.ts     TanStack Query factory
│   │   ├── db/                 Dexie schema + client
│   │   ├── geo/                Turf wrappers (area, length, distance, etc.)
│   │   ├── repositories/       Repository pattern (Dexie now, Supabase later)
│   │   └── supabase/           Browser + server + middleware clients
│   ├── styles/
│   │   └── tokens.css          Three-layer design tokens
│   └── middleware.ts           Refreshes Supabase auth cookies
├── supabase/
│   ├── config.toml             Local dev project config
│   └── migrations/
│       └── 0001_init.sql       Schema + RLS + spatial helpers
├── .env.example
├── next.config.ts
└── package.json
```

## Quick start

```bash
# 1. install deps
pnpm install

# 2. copy env (Supabase keys are optional for v1)
cp .env.example .env.local

# 3. run the dev server
pnpm dev    # → http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Next dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | ESLint flat config |
| `pnpm format` | Prettier write |
| `pnpm format:check` | Prettier verify |
| `pnpm supabase` | Supabase CLI (linked once `supabase link --project-ref <id>`) |
| `pnpm types:supabase` | Regenerate Supabase types into `src/lib/supabase/types.ts` |

## Roadmap

- **Phase 1 — Foundation** *(this commit)* — scaffold, design system, data layer, API proxies, glass primitives, repository pattern.
- **Phase 2 — Map workspace** — MapLibre + glass overlays, address search, click-to-detect building, auto area/perimeter readout.
- **Phase 3 — Drawing tools** — terra-draw integration, distance/area/setback measurement.
- **Phase 4 — Cloud sync** — Supabase auth, sync engine, project sharing.
- **Phase 5 — Use-case polish** — per-vertical UI presets, GeoJSON/KML/CSV/PDF export.

## Data attribution

Building footprints © OpenStreetMap contributors (ODbL). Geocoding via Nominatim. Satellite imagery via Esri World Imagery (TBD on integration).

## License

Private — TBD.
