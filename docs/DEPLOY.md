# Deploying Polaris CRM to production (Vercel)

A step-by-step runbook for a first production deploy and for routine
redeploys. The app is Next.js 15 (App Router) + Prisma + Supabase Postgres,
with optional Upstash Redis, Inngest, and Supabase Storage.

> **Region matters.** Serverless functions are pinned to **Singapore (`sin1`)**
> in [`vercel.json`](../vercel.json) so they sit next to the Supabase database
> (also Singapore, `ap-southeast-1`). This is the real fix for the request
> latency we saw in development — keep the function region and the DB region the
> same.

---

## 0. Prerequisites (one-time)

- A **Vercel** account with access to the GitHub repo `Adrian6204/PolarisCRM`.
- The **Supabase** project (Singapore) — connection strings for the pooled
  (`DATABASE_URL`) and direct (`DIRECT_URL`) connections.
- Optional: **Upstash Redis** (rate limiting + analytics cache), **Inngest**
  (durable background jobs), **Sentry** (errors), **Supabase Storage** keys
  (file attachments).

Generate the secrets you'll need:

```bash
# NextAuth session secret
openssl rand -base64 32
# Cron shared secret (Vercel Cron → cron endpoints)
openssl rand -hex 32
```

---

## 1. Import the project into Vercel

1. Vercel → **Add New… → Project** → import `Adrian6204/PolarisCRM`.
2. Framework preset: **Next.js** (auto-detected). Leave the build command as the
   default — `package.json`'s `build` already runs `prisma generate && next build`.
3. Don't deploy yet — set environment variables first (next step).

The `sin1` region is read from `vercel.json`; no dashboard change needed.

---

## 2. Environment variables (Project → Settings → Environment Variables)

Set these for **Production** (and Preview if you use it). See
[`.env.example`](../.env.example) for the full shape.

**Required**

| Var | Value |
|-----|-------|
| `DATABASE_URL` | Supabase **pooled** connection string (port 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | Supabase **direct** connection string (port 5432) — used by migrations |
| `NEXTAUTH_SECRET` | output of `openssl rand -base64 32` |
| `NEXTAUTH_URL` | the production URL, e.g. `https://polaris-crm.vercel.app` — **must match the real domain** or logout/login redirects break |

**Recommended**

| Var | Purpose |
|-----|---------|
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | rate limiting + analytics cache (degrades gracefully if unset) |
| `CRON_SECRET` | `openssl rand -hex 32` — required so the cron endpoints reject public calls in prod |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | durable background jobs (renewal + reminder scans) |

**Optional**

| Var | Purpose |
|-----|---------|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | enables client file attachments (server-only key; never `NEXT_PUBLIC_*`) |
| `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` | error reporting |
| `LOG_LEVEL` | `info` in prod (default) |

`NODE_ENV=production` is set by Vercel automatically.

---

## 3. Database migrations

Vercel's build runs `prisma generate` but **not** migrations. Apply them against
the **direct** connection before (or right after) the first deploy:

```bash
# from your machine, with DIRECT_URL pointing at the prod DB
DIRECT_URL="postgresql://…:5432/postgres" \
DATABASE_URL="postgresql://…:6543/postgres?pgbouncer=true" \
npm run prisma:deploy      # = prisma migrate deploy
```

`migrate deploy` applies only already-created migrations (no prompts, no drift)
— safe for CI/CD. Row-Level Security is enabled by the migrations; the app
connects as the owner role and bypasses it, which locks the public REST API.

> First deploy only: if you want sample data, `npm run db:seed` (creates the
> default pipeline, demo users, etc.). Skip for a real production tenant.

---

## 4. Deploy

Push to `main` (or click **Deploy**). CI (`.github/workflows/ci.yml`) gates every
push with lint → typecheck → test → build. Vercel builds and deploys from the
same commit.

---

## 5. Cron (already configured)

[`vercel.json`](../vercel.json) declares two Vercel Cron jobs:

- `POST /api/cron/scan-renewals` — daily 08:00 UTC (upcoming retainer renewals)
- `GET  /api/cron/scan-reminders` — hourly (appointment/task reminders → in-app
  notifications, and time-based automations)

Both require `Authorization: Bearer $CRON_SECRET`; Vercel Cron sends it
automatically once `CRON_SECRET` is set. For durable execution, connect the
Inngest app to the `/api/inngest` endpoint and set the Inngest keys.

---

## 6. Post-deploy smoke check

1. `GET /api/health` → `{ status: "ok", checks: { database: "ok", redis: "ok" } }`.
2. Sign in (seeded admin, or create the first admin via seed/DB).
3. Create a client, move a deal on the pipeline, open ⌘K search.
4. Confirm the notification bell loads and Settings → Team is admin-gated.
5. If Supabase Storage is configured: upload a file on a client's **Files**
   section and download it back.

---

## Routine redeploys

- Merge to `main` → CI runs → Vercel auto-deploys.
- New DB migration? Run `npm run prisma:deploy` against prod (step 3) as part of
  the release. Never run `prisma migrate dev`/`reset` against production.
- Rotate `NEXTAUTH_SECRET` only during a maintenance window (invalidates
  sessions).
