# Deploying the host to Vercel with a Supabase database

This runbook covers the deployment path that produced the readiness failure
"Database or schema dependency unavailable. Dependency unknown unavailable (500)".

## Why that error happened

Three independent gaps, each of which alone breaks `/health/ready`:

1. **The build never applied migrations.** `next build` compiles the app; it does not touch the
   database. A deploy could therefore ship an app whose schema did not exist - the readiness probe
   then had no `_prisma_migrations` table to find.
2. **The application only read `DATABASE_URL`.** The Supabase ↔ Vercel integration injects
   `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, and `POSTGRES_URL_NON_POOLING` - *not* `DATABASE_URL`.
   With none of those names mapped, configuration failed and the HTTP layer answered a generic
   `500 UNEXPECTED_FAILURE` with no `dependency`, which the UI rendered as
   "Dependency **unknown** unavailable (500)".
3. **Migrations and runtime need different connections.** Supabase's transaction pooler
   (port 6543) cannot run migrations; migrations need the session/direct connection (port 5432).

## What the app expects now

| Variable | Scope | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Production, Preview | **Runtime** connection. Use the pooled URL (Supabase transaction pooler, port 6543). |
| `DIRECT_URL` | Production | **Migrations** only. Session/direct connection, port 5432. |
| `APP_ORIGIN` | Production | Exact web origin. Optional on Vercel (falls back to `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`). |
| `CORS_ORIGINS` | optional | Comma-separated extra origins. Same-origin needs nothing. |

Alternative names are accepted everywhere the connection string is resolved, so the
Supabase ↔ Vercel integration variables work without renaming anything:

- runtime: `DATABASE_URL` → `POSTGRES_PRISMA_URL` → `POSTGRES_URL` → `SUPABASE_DB_URL`
- migrations: `DIRECT_URL` → `POSTGRES_URL_NON_POOLING` → the runtime list

Copy the values from Supabase → Project Settings → Database:

- **Transaction pooler** (`aws-0-<region>.pooler.supabase.com:6543`, add `?pgbouncer=true`) → `DATABASE_URL`
- **Session / direct** (`...pooler.supabase.com:5432` or `db.<ref>.supabase.co:5432`) → `DIRECT_URL`

> Supabase direct connections (`db.<ref>.supabase.co`) are IPv6-only. If the build or your laptop
> has no IPv6 route, use the **session pooler** URL on port 5432 for `DIRECT_URL` instead.

## Deploy

The repository ships `vercel.json`:

```json
{ "buildCommand": "npm run build:vercel" }
```

`build:vercel` = generate the Prisma client (resilient, warns instead of failing) → apply pending
migrations → `next build`:

```json
"build:vercel": "node scripts/prisma-generate.mjs && node scripts/migrate-deploy.mjs && next build"
```

When the project's Build Command is configured in the Vercel dashboard, that setting wins over
`vercel.json` - set it to `npm run build:vercel` there as well.

Escape hatches (environment variables):

| Variable | Effect |
| --- | --- |
| `SKIP_DB_MIGRATE=true` | Skip migrations in this build (for example a preview with no database). |
| `DB_MIGRATE_OPTIONAL=true` | Warn instead of failing the build when migrations fail. |
| `MIGRATE_TIMEOUT_MS=120000` | Hard timeout for the migration run. |
| `PRISMA_GENERATE_REQUIRED=true` | Fail the build when the Prisma client cannot be generated. |
| `PG_POOL_MAX=5` | Lower the per-instance pool size on serverless. |

A production build with **no** connection string fails immediately with the list of accepted
variable names, instead of deploying a host that can never become ready.

## Apply migrations manually (no redeploy)

```bash
# With DIRECT_URL (or DATABASE_URL) pointing at the production session connection:
DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
  npm run db:migrate:deploy     # resolves the direct URL, refuses port 6543, prints no secrets
npm run db:status               # requires DIRECT_URL / DATABASE_URL in the environment
```

The migration runner prints only `host:port/database` and the *name* of the variable used - never
the credential - and translates Prisma/Postgres failures (P1001, P1000, P3005, 42P07, 28P01, …)
into a diagnosis plus a fix.

## Verify the deployment

```bash
curl -i https://<your-app>/health/live     # 200 {"status":"alive", ...}
curl -i https://<your-app>/health/ready    # 200 {"status":"ready", ...}
```

A failing readiness answer is now self-describing (RFC 9457):

```json
{
  "title": "Database schema not ready",
  "status": 503,
  "code": "SCHEMA_NOT_READY",
  "correlationId": "01a0…",
  "dependency": "schema",
  "reason": "migration_table_missing",
  "detail": "The database has no migration history (missing _prisma_migrations). Apply migrations with the direct (port 5432) connection: npm run db:migrate."
}
```

The UI shows the same fields (dependency, code, reason, correlation id) plus the fix hint, so the
**Retry** button re-runs the bounded probe with full context. Reasons you can expect:

| Reason | Dependency | Meaning |
| --- | --- | --- |
| `database_url_missing` | database | No connection string in this environment (also used when configuration is unreadable). |
| `connection_refused` | database | Host/port does not accept connections. |
| `connection_timeout` | database | No answer within the 2 s probe budget. |
| `authentication_failed` | database | Wrong role/password. |
| `database_missing` | database | Database name does not exist. |
| `too_many_connections` | database | Pooler/connection limit exhausted. |
| `server_unavailable` | database | Postgres restarting or in maintenance. |
| `migration_table_missing` | schema | Reachable, but no `_prisma_migrations`. |
| `no_migrations_applied` | schema | History table exists and is empty. |
| `foundation_migration_not_applied` | schema | `001_solution_foundation` missing. |
| `migration_history_drift` | schema | Tables exist but Prisma does not know the migration: `npx prisma migrate resolve --applied 20250912000000_001_solution_foundation`. |

## Health endpoint contract

- `/health/live` answers 200 as long as the process serves requests - it never depends on the
  database *or* on database configuration.
- `/health/ready` is bounded to 2 s and answers either 200 `{status:"ready"}` or
  `503` `application/problem+json` with `code`, `dependency`, `reason`, and a remediation `detail`.

## Troubleshooting log lines

The route dispatcher logs stable machine fields only (no driver messages, no connection strings):

```json
{"level":"warn","operation":"getReadiness","status":503,"code":"SCHEMA_NOT_READY",
 "dependency":"schema","reason":"migration_table_missing","errorName":"UnavailableError",
 "correlationId":"01a0…"}
```

Filter the Vercel function logs by `correlationId` from the UI chip to find the exact failing
request, then match `reason` against the table above.
