# Polaris CRM

Internal CRM for **Polaris.Dev** — client and project management across the
agency's service lines (web dev, SEO, software dev, app dev, AIGC). Built
serverless-native for Vercel. See [SPEC.md](./SPEC.md) for the full spec and
phased build order.

## Stack

| Concern         | Choice                                            |
| --------------- | ------------------------------------------------- |
| Framework       | Next.js (App Router) + Tailwind                   |
| Database        | PostgreSQL (Neon/Supabase pooler in prod)         |
| ORM             | Prisma (pooled `DATABASE_URL`, direct migrations) |
| Cache / limits  | Upstash Redis (REST) + `@upstash/ratelimit`       |
| Validation      | Zod                                               |
| Auth            | NextAuth (Auth.js), role-based (JWT sessions)     |
| Logging         | Pino (structured, request-scoped)                 |
| Errors          | Sentry (optional locally)                         |
| Tests           | Vitest                                            |
| CI/CD           | GitHub Actions (lint → typecheck → test → build)  |

## Local setup

```bash
cp .env.example .env          # fill in values (defaults work with docker-compose)
docker compose up -d          # local Postgres
npm install
npm run prisma:migrate        # create schema
npm run db:seed               # seed one user per role
npm run dev                   # http://localhost:3000
```

Health check: [`/api/health`](http://localhost:3000/api/health).

Seeded logins (local only): `admin@polaris.dev`, `lead@polaris.dev`,
`member@polaris.dev` — all password `password123`.

## Architecture conventions

These cross-cutting patterns apply to **every** API route (see SPEC):

- **One route wrapper** — [`withApiRoute`](src/lib/api.ts) attaches a
  `requestId`, request-scoped [logger](src/lib/logger.ts), optional
  [rate limiting](src/lib/ratelimit.ts), and uniform
  [error handling](src/lib/errors.ts) with Sentry reporting.
- **Validate first** — `parseJson` / `parseQuery` run a Zod schema before any
  DB access. Shared primitives live in [validation.ts](src/lib/validation.ts).
- **Auth on every route** — `requireUser` / `requireRole` from
  [auth.ts](src/lib/auth.ts); no route ships without an explicit check.
- **Rate limiting is scoped**, not blanket: `auth` (strict) / `write`
  (moderate) / `read` (light). Internal reads may omit it.
- **Serverless-safe** — Prisma and Redis clients are singletons/REST-based; no
  long-running processes or persistent connections.

## Build phases

Built one phase at a time (commit per phase). Current status:

- [x] **Phase 0** — Infra scaffolding
- [x] **Phase 1** — Clients & Contacts (CRUD, soft delete, nested contacts)
- [x] **Phase 2** — Projects (per-service stage sets, Kanban board, detail)
- [ ] Phase 3 — Deliverables
- [ ] Phase 4 — Activity Log
- [ ] Phase 5 — Retainer flags & scheduled jobs
- [ ] Phase 6 — Reporting & caching
- [ ] Phase 7 — Audit Log
- [ ] Phase 8 — Sales pipeline
- [ ] Phase 9 — Hardening pass
