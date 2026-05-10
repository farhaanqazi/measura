@AGENTS.md

# Measura — engineering notes for AI agents

## Stack quick reference
- **Next.js 16** (App Router, Turbopack, React 19) — read `node_modules/next/dist/docs/` before writing route or caching code, Next 16 has breaking changes from training data
- **Tailwind v4** with `@theme inline` in `src/app/globals.css`
- **Design tokens** live in `src/styles/tokens.css` — three layers (primitive → semantic → component)
- **MapLibre GL JS** for the map; **Turf.js** for geo math; **terra-draw** for drawing tools

## Conventions
- Imports use `@/*` → `src/*`
- All measurements stored in **meters / sq meters** internally; format at the edge with `formatLength` / `formatArea`
- All geometry in **GeoJSON WGS84 (EPSG:4326)**
- Server-side proxies (geocode, buildings) go through `src/app/api/*/route.ts` with CDN caching
- Local-first: writes hit Dexie + outbox first; SyncEngine drains to Supabase later
- Repository pattern — never call Dexie or Supabase directly from components, go through `src/lib/repositories/*`

## Glass surface usage
Use the `Glass` primitive from `@/components/glass/Glass` rather than ad-hoc backdrop-blur classes:
```tsx
<Glass intensity="strong" radius="xl" elevation="md">…</Glass>
```
**Never stack >2 glass layers** — compounding `backdrop-blur` kills GPU perf.

## Adding a new server-side proxy
1. Create `src/app/api/<name>/route.ts`
2. Validate query with Zod
3. Set `revalidate` for CDN caching
4. Use the `User-Agent` from `env.NOMINATIM_USER_AGENT` (or a project-specific one) for OSM-derived APIs

## Generating Supabase types
After any schema change:
```bash
pnpm supabase db push
pnpm supabase gen types typescript --linked > src/lib/supabase/types.ts
```
