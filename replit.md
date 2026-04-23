# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Home-Navi — Japanese-language care facility management web app (モバイルファースト, PC-compatible).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + Wouter + TanStack Query

## Project Structure

```
artifacts/
  api-server/        — Express API server (port 8080)
  home-navi/         — React frontend (port 22173, previewPath /)
  mockup-sandbox/    — Vite component preview (port 8081)
lib/
  api-spec/          — OpenAPI spec (source of truth) + Orval config
  api-zod/           — Zod schemas generated from OpenAPI
  api-client-react/  — React Query hooks generated from OpenAPI
  db/                — Drizzle ORM schema and client
```

## API Routes (api-server)

All routes under `/api/` prefix:
- `GET /api/healthz` — health check
- `GET/POST/PATCH/DELETE /api/residents` — resident management
- `GET/POST/PATCH/DELETE /api/staff` — staff management
- `GET/POST/PATCH/DELETE /api/handover-notes` — handover notes
- `GET/POST/PATCH/DELETE /api/vitals` + `GET /api/vitals/today-status` — vital records
- `GET/POST/PATCH/DELETE /api/meals` — meal records
- `GET/POST/PATCH/DELETE /api/weights` + `GET /api/weights/monthly-status` — weight records
- `GET/POST/DELETE /api/eliminations` + round management — elimination records
- `GET/POST/PATCH/DELETE /api/day-services` + toggle-prepared — day service preparations
- `GET/POST/PATCH/DELETE /api/bath-reports` — bath reports
- `GET/POST/PATCH/DELETE /api/insurances` — insurance records
- `GET /api/dashboard/today` + `GET /api/dashboard/alerts` — dashboard summaries

## Database Schema

Tables: `residents`, `staff`, `handover_notes`, `vitals`, `meals`, `weights`, `eliminations`, `elimination_round_checks`, `elimination_round_state`, `day_services`, `bath_reports`, `insurances`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Important Notes

- Orval config: zod output uses `mode: "single"`, `target: "generated/api.ts"` — do NOT add `schemas` option
- After codegen, ensure `lib/api-zod/src/index.ts` = `export * from "./generated/api";`
- DB numeric fields (temperature, weightKg) stored as Postgres `numeric`, must `parseFloat(String(val))` when returning JSON
- `vitals/today-status` registered BEFORE `/vitals/:id` in Express to avoid param conflict
- Vite dev server proxies `/api` → `http://localhost:8080` for frontend development
- `home-navi-requirements.md` is the source of truth for all features

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
