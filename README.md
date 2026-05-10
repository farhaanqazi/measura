# Measura

> Measure any building, anywhere. Locate buildings on satellite imagery and compute their footprint, dimensions, height, and surrounding distances.

## Structure

```
building-measure-app/
├── web/        → Next.js 16 web app (frontend + API routes)
└── _local/     → in-repo reference materials (design system skill, etc.) — gitignored
```

This is single-app for now; `web/` can grow into `apps/web` alongside future `apps/api`, `packages/ui`, etc. without breaking imports.

## Quick start

```bash
cd web
pnpm install
cp .env.example .env.local   # all vars optional; works out of the box
pnpm dev                     # → http://localhost:3000
```

See [web/README.md](web/README.md) for the full stack overview, project structure, and roadmap.

## License

Private — TBD.
