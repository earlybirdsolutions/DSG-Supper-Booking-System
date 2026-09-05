# DSG Supper Booking

A mobile-first supper reservation system for DSG day scholars, kitchen staff, finance, and IT administrators.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/dsg-supper/` — React scholar, kitchen, and admin interfaces
- `artifacts/api-server/src/routes/dsg.ts` — booking rules and API handlers
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/db/src/schema/` — students, bookings, and settings tables
- `artifacts/dsg-supper/src/index.css` — visual theme tokens

## Architecture decisions

- Calendar dates stay as `YYYY-MM-DD` strings throughout the API and database to avoid timezone shifts.
- All cutoff calculations use `Africa/Johannesburg`.
- Clerk provides secure browser sessions; the database whitelist determines who may book and which signed-in users may administer the app.
- The kitchen dashboard is shareable without full role management; admin endpoints require an authenticated email in `adminEmails`.

## Product

- Scholars can confirm eligibility, sign in, book future suppers before cutoff, and cancel before cutoff.
- Kitchen staff can view a live, auto-refreshing daily headcount and scholar list.
- Administrators can manage cutoff/notification settings, the student whitelist, and booking history.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run API codegen after every OpenAPI change.
- Transactional email delivery still requires a connected email provider; booking events currently log the intended recipient counts.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
