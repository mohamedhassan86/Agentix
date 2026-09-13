# Agentix Foundation

**Solution foundation for tenancy and identity**: a compiling application host, enforced architecture boundaries, stable API and error baseline, durable persistence and background-work foundations, observability, canonical design tokens, continuous-integration and test gates, with no business entities.

This is **Feature 001** - the prerequisite for all later features (tenancy, secrets, projects, agents, metering, etc.).

## What this foundation provides

- **Runnable hosts**: One Next.js 16 App Router web app and one Node worker, both start keylessly without paid provider credentials
- **Health**: Liveness (process only) at `/health/live` and readiness (bounded 2s DB/schema probe) at `/health/ready`, both with `X-Correlation-Id` and `Cache-Control: no-store`
- **Versioned ping**: `GET /api/v1/ping` exercises versioned query dispatch, correlation propagation, RFC 9457 errors
- **Durable work**: Transactional outbox with `FOR UPDATE SKIP LOCKED` claim, bounded retries (base 1s cap 30s jitter, max 3), lease reaper, idempotent handler, exactly-once effect
- **Foundation demo**: Non-business `POST /api/v1/foundation/work` and `GET /api/v1/foundation/work/{requestId}` - atomic request+work, idempotency key, same-origin Location, disabled in production by default
- **Architecture**: Fixed `src/{domain,application,infrastructure,app,worker}` layout, dependency-cruiser enforces inward-only, zero violations in prod graph, forbidden fixtures fail
- **Observability**: Pino JSON logs with child diagnostic context, recursive redaction (authorization, cookie, password, token, secret, key, connection), body/payload omission, stable error codes [REDACTED], OpenTelemetry traces/metrics with bounded attributes, W3C propagation, correlation_id/work_id in logs not metric labels
- **Design**: Canonical tokens from `Public/Desgin/index.html` - --bg, --surface, --border, --text, --primary, --radius, etc., variable-based components .card .btn .status-chip .banner .field, visible focus, 4.5:1 body 3:1 icon contrast, reduced-motion, responsive, no external font requests
- **Gates**: One standard sequence `npm run lint && npm test && npm run build && npm run license:check && npm run architecture:check && npm run openapi:check && npm run test:policy` - same locally and in CI

**Out of scope**: No auth, organizations, projects, secrets vault, provider SDKs, runs, metering, billing, webhooks, simulator, approval.

## Prerequisites

- Node.js 22 LTS (`node --version` should report v22)
- npm
- Docker for PostgreSQL 16 (or isolated PostgreSQL 16+ database)
- No paid provider credentials needed

## Quickstart - Clean checkout to running foundation

```bash
# 1. Install
npm ci

# 2. Configure - copy example, set DATABASE_URL
cp .env.example .env.local
# Edit .env.local: DATABASE_URL=postgresql://test:test@localhost:5432/agentix_test

# 3. Validate config (fail-fast, no secret leakage)
npm run config:check
# Try omitting DATABASE_URL - should fail with setting name and remediation, never prints value

# 4. Start PostgreSQL
docker run -d --name agentix-pg -p 5432:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_DB=agentix_test postgres:16
# Or use existing PostgreSQL 16

# 5. Apply migration (apply twice safe)
npm run prisma:validate
npm run db:migrate
npm run db:status
# Expected: 001_solution_foundation applied, only outbox/attempt and foundation demo tables, no user/org/project/secret/run tables

# 6. Start app and worker (keyless)
# Terminal 1:
npm run dev -- --hostname 0.0.0.0
# Terminal 2:
npm run worker

# 7. Validate health, ping, correlation
curl -i http://localhost:3000/health/live
curl -i http://localhost:3000/health/ready
curl -i http://localhost:3000/api/v1/ping
curl -i -H 'X-Correlation-Id: 0199f000-0000-7000-8000-000000000123' http://localhost:3000/api/v1/ping
curl -i -H 'X-Correlation-Id: malformed-and-too-long' http://localhost:3000/api/v1/ping
# Expected: 200, status alive/ready/ok, X-Correlation-Id present, valid UUID propagated, malformed replaced not echoed, no-store, no DB details

# 8. Stop PostgreSQL while app running - liveness 200, readiness 503 with dependency database, no connection details, recovery without restart when DB returns

# 9. Prove atomic work and idempotency (with worker running, demo enabled in local)
curl -i -X POST -H 'Content-Type: application/json' -H 'Idempotency-Key: reviewer-foundation-001' -d '{}' http://localhost:3000/api/v1/foundation/work
# Follow Location:
curl -i http://localhost:3000/api/v1/foundation/work/<requestId>
# Expected: first 202, same key 200 same IDs, terminal succeeded, effectCount 1, no payload/SQL/stack/secret

# 10. Run gates
npm run lint
npm test
npm run build
npm run architecture:check
npm run openapi:check
npm run license:check
npm run test:policy
npm run openapi:generate

# Full sequence (same in CI):
npm run lint && npm test && npm run build && npm run license:check && npm run architecture:check && npm run openapi:check && npm run test:policy
```

## Repository layout

```
specs/001-solution-foundation/  Feature spec, plan, research, data-model, contracts, tasks, quickstart, checklists
contracts/openapi/              Generated OpenAPI 3.1 JSON (agentix-v1.json) - committed, drift-checked
prisma/                         schema.prisma and migrations/001_solution_foundation
src/domain/                     Pure extension point (no business yet)
src/application/
  foundation/                   queries/commands/handlers/dto for health, ping, work (framework-free)
  shared/                       dispatch, context, errors, ports, work (WorkEnvelope, WorkContext, WorkResult, Registry)
src/infrastructure/
  config/                       Immutable loader, fail-fast, bounded, toJSON redacted, non-enumerable databaseUrl
  observability/                Pino logger, redaction, diagnostic-context, telemetry, metrics, propagation
  persistence/                  pg pool, prisma client with fallback stub, clock, id-generator, unit-of-work, migration-readiness, foundation-demo-repository, outbox-writer, outbox-query
  work/                         postgres-work-claimer (SKIP LOCKED), lease-reaper, retry-policy, work-outcome-writer, worker-coordinator
src/app/
  health/live/                  Liveness route - no dependency check
  health/ready/                 Readiness route - bounded 2s probe, dependency category, no connection details
  api/v1/ping/                  Versioned ping - one parse + one dispatch
  api/v1/foundation/work/       Demo work create/status - thin routes, environment-gated, idempotency, same-origin Location
  components/foundation/        foundation-status.tsx - loading/ready/error/retry, text-plus-color, aria-live polite, keyboard, focus, reduced-motion
  lib/                          composition-root singleton, route-dispatch with correlation/CORS/error/metrics, problem-response, correlation, cors, openapi-registry, api/client (relative URLs)
  globals.css                   Canonical tokens --bg --surface --border --text --primary --radius, variable-based .card .btn .status-chip .banner .field, focus-visible, reduced-motion, responsive, 200% zoom
src/worker/                     main.ts with heartbeat, readiness, SIGTERM/SIGINT graceful shutdown ≤30s, composition-root with work registry and coordinator
tests/
  architecture/                 dependency-rules, thin-routes, no-business-scope, fixtures
  contract/foundation/          openapi, scope-inventory
  integration/
    api/foundation/             health, ping-and-errors
    app/                        startup
    persistence/                foundation-migration, outbox-constraints, atomic-outbox
    worker/                     concurrent-claim, idempotent-redelivery, retry-policy, lease-recovery, graceful-shutdown, scope-validation
    observability/              correlation
    security/                   diagnostic-redaction (zero leakage)
    performance/                foundation-read (p95 <300ms, probe ≤2s)
  unit/
    application/                dispatcher, correlation, errors
    infrastructure/             config, logger, telemetry-policy
    ui/foundation/              foundation-status, design-tokens
  e2e/                          foundation.spec.ts - branding, states, keyboard, focus, aria-live, narrow, 200% zoom, reduced-motion, no fake auth
```

## Architecture enforcement

```bash
npm run architecture:check
# Runs dependency-cruiser on src - zero violations expected
# Forbidden fixtures (tests/architecture/fixtures) must fail with source->target
```

Rules:
- Domain must not import outside Domain
- Application must not import Infrastructure, App, Worker, React, Next, Prisma
- App must not import Prisma directly (only via Infrastructure wrapper)
- No circular dependencies

Thin-route rule: route.ts must be <150 lines, use dispatchRoute, no PrismaClient, no business table names.

## HTTP and error baseline

- Versioned from first contract: `/api/v1/ping`
- Every response carries `X-Correlation-Id` - valid caller UUID propagated, malformed replaced not echoed
- Non-success uses RFC 9457 ProblemDetails: type, title, status, code (^[A-Z][A-Z0-9_]{1,119}$), correlationId, safe detail, errors, dependency
- CORS: exact-origin parsing via URL.origin, explicit allow-list, disallowed origin denied with 403 Problem
- Same-origin client: `src/app/lib/api/client.ts` uses relative URLs, no hard-coded host
- OpenAPI: Zod schemas + `@asteasolutions/zod-to-openapi` generate `contracts/openapi/agentix-v1.json`, drift fails `openapi:check`

## Persistence and background work

- Migration `001_solution_foundation`: outbox_messages, outbox_attempts, foundation_demo_requests, foundation_demo_effects with exact limits (work type 1-120, idempotency 1-200, traceparent ≤55, tracestate ≤512, payload ≤64 KiB), checks, indexes (due, lease, tenant-leading, correlation, terminal), unique constraints
- Atomic enqueue: `FoundationDemoRepository.createRequestWithOutboxAtomic` uses `$transaction` - both commit or both rollback
- Idempotency: duplicate (type,scope,owner,key) returns one work item, same request ID
- Claim: `PostgresWorkClaimer` uses `FOR UPDATE SKIP LOCKED`, `ORDER BY available_at,created_at,id`, short transaction, attempt row insertion, lease ownership 30s
- Lease reaper: `PostgresLeaseReaper` recovers expired leases, resets to pending, records `lease_expired`
- Retry: `RetryPolicy` base 1s cap 30s jitter, max 3 bounded 1-10, transient -> retry_scheduled with nextAvailableAt, unknown version -> failed permanent
- Handler: `foundation.demo.requested` v1 idempotent - unique request/work effect via DB unique constraints, request completion, outbox success, redelivery safe (23505 handling)
- Worker: `WorkerCoordinator` poll 1000 batch 10 lease 30s, W3C context propagation, cancellation via AbortSignal, graceful shutdown ≤30s or recoverable lease, never retry indefinitely
- Scope: tenant requires orgId, global forbids orgId, fail closed, explicit `globalWork`/`tenantWork` factories, sensitive-key rejection

## Diagnostics and zero leakage

- Logs: Pino JSON with timestamp, severity, correlation_id, operation/work identity, status, safe error code [REDACTED], child diagnostic context, recursive redaction, body/payload omission
- Traces: OTel bootstrap with optional OTLP exporters, graceful shutdown, bounded metric/span attributes, correlation_id/work_id in logs/spans not metric labels, validated W3C traceparent/tracestate
- Metrics: baseline counters/durations - http_request_duration_seconds, http_requests_total, http_failures_total, work_success_total, work_failure_total, work_retry_total, outbox_claim_duration_seconds, readiness_state - allow-list labels only (operation,status,service,dependency,outcome,work_type,method,route)
- Zero leakage: seeded markers (supersecret, secret123, postgres://, sk-*, BEGIN RSA PRIVATE KEY) appear zero times across responses, health, Pino sink, spans, metrics, Problem Details, outbox error fields, OpenAPI, snapshots - verified by `tests/integration/security/diagnostic-redaction.test.ts`

## Design baseline

- Tokens: exact mock names/values from `Public/Desgin/index.html` - --bg #080b11, --surface #0f141e, --border #222b3b, --text #f4f6fb, --primary #8274f8, --radius 14px, etc.
- Components: .card, .card-header, .btn, .btn-primary, .status-chip, .banner, .field - all use var(--) not literal hex
- States: loading, ready, dependency-error, retry - text-plus-color, aria-live polite, retry labelled keyboard operable
- Accessibility: keyboard operable, focus-visible 2px solid --primary-bright, 4.5:1 body 3:1 icon/large, 200% zoom no horizontal loss, narrow viewport 320px, reduced-motion disables animations/transitions, no external font requests, Inter system fallback
- No fake auth/tenant/project/provider/run/billing/simulator/approval controls

## Verification gates

Same locally and in CI (Node 22, PostgreSQL 16):

```bash
npm run lint && npm test && npm run build && npm run license:check && npm run architecture:check && npm run openapi:check && npm run test:policy
```

- `lint`: zero-warning ESLint
- `test`: Vitest 5 unit/integration/ui/architecture/contract - 98 tests, no .skip/.only/todo/placeholder
- `build`: Next.js 16 production build, type-checks app and worker, routes: /, /health/live, /health/ready, /api/v1/ping, /api/v1/foundation/work, /api/v1/foundation/work/[requestId]
- `license:check`: allow-only MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0 - 994 packages
- `architecture:check`: dependency-cruiser zero violations, forbidden fixtures fail
- `openapi:check`: committed JSON exists, has required paths/operationIds, no drift
- `test:policy`: no .skip/.only/todo/placeholder
- `prisma:validate`, `db:migrate`, `db:status`: migration applies twice safe
- `openapi:generate`: generates from Zod schemas

## Deployment

- Web: Next.js Node runtime on Vercel or equivalent Node host, same-origin browser calls
- Worker: Separate long-running Node container/process, no extra HTTP server, `npm run worker` or `tsx src/worker/main.ts`
- Database: PostgreSQL 16+, a Postgres URL required (see below), production `APP_ORIGIN` required exact origin, CORS_ORIGINS comma-separated exact origins
- Env: `.env.example` documents all settings, `.env*` ignored except example, no real connection string or secret committed
- Worker notices work within 2s, shutdown within 30s

### Vercel + Vercel Postgres (Neon) runbook

1. Connect the integration (Project → Integrations → Postgres/Neon), then make sure the
   variables are enabled for **Production *and* Preview**:
   `vercel env ls production` should list `POSTGRES_URL`, `POSTGRES_PRISMA_URL`,
   `POSTGRES_URL_NON_POOLING` (older projects) or `DATABASE_URL` / `DATABASE_URL_UNPOOLED`
   (newer Neon-provisioned projects). The app reads either set — see
   `src/infrastructure/config/database-url.ts` — and enforces `sslmode=require` for remote hosts.
2. Add the non-secret app vars: `APP_ORIGIN=https://<your-production-domain>`,
   optionally `CORS_ORIGINS`.
3. Let `postinstall` generate the client: `prisma generate && node scripts/check-prisma-generated.mjs`.
   `src/generated/prisma/client.ts` is a committed **offline stub** (`findUnique → null`,
   `create → {}`, `$transaction(fn)` runs `fn` with no transaction), and the file is only real
   after generation - that is why the schema now uses Prisma 7's `provider = "prisma-client"`
   (it writes `<output>/client.ts`); the legacy `prisma-client-js` writes `index.js` instead and
   left the stub in place, which is what made a deployed app look unable to connect.
   If a stub ever ships, the app does not lie: `/health/live` and `/api/v1/ping` stay 200 while
   any data route answers `503 PRISMA_CLIENT_NOT_GENERATED`. `ALLOW_PRISMA_STUB=true` silences it
   for offline development only. If the build cannot reach `binaries.prisma.sh`, set
   `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` like CI does. If `npm run worker` (tsx) reports
   `Cannot find module './internal/class.js'`, add `importFileExtension = "ts"` to the generator block.
4. Apply the schema **once** against the direct endpoint — never through the pooler, because
   `CREATE TYPE` cannot run inside a PgBouncer transaction:
   ```bash
   vercel env pull .env.local
   npm run db:doctor          # shows which URL/pooler/TLS/migration state you have
   npm run db:migrate         # uses POSTGRES_URL_NON_POOLING / DATABASE_URL_UNPOOLED
   ```
5. `npm run build` locally before pushing; then check `https://<app>/health/ready`. A 503 carries a
   machine-readable `code` and, for dependency failures, a category the browser banner shows too:

   | `code` | meaning | fix |
   | --- | --- | --- |
   | `CONFIG_MISSING` | no Postgres URL in this environment | enable the integration vars for Production *and* Preview |
   | `PRISMA_CLIENT_NOT_GENERATED` | the offline stub shipped | make the build run `prisma generate` |
   | `PRISMA_ADAPTER_MISSING` | `@prisma/adapter-pg` unloadable | reinstall deps (`npm ci`) |
   | `UNAVAILABLE` + `Dependency database not ready: <category>` | the DB itself | `dns_not_resolved`, `connection_refused`, `connect_timeout`, `auth_failed`, `ip_not_allowed`, `tls_handshake_failed`, `too_many_connections`, `pool_acquired_timeout` → see the remediation list in `src/infrastructure/persistence/connection-error.ts` |
   | `UNAVAILABLE` + `Dependency schema not ready` | reachable DB, missing tables | `npm run db:migrate` with the non-pooled URL |

   No host, user or password ever leaves the process.
6. Deployment-side limits to respect: routes must run on the Node runtime (no `runtime = "edge"`
   for DB routes), serverless instances must keep `DB_POOL_MAX` at 1–3 when the URL contains a
   `-pooler` host, and the outbox worker cannot live on Vercel — host `npm run worker` elsewhere
   (Railway/Fly/container) or drive it from Vercel Cron hitting a route.

Debugging without redeploying: `npm run db:doctor -- --json` runs the exact same resolution order
the deployed app uses, so a green doctor plus a red app means the *deployment environment* is
missing a variable rather than the URL being wrong.

## Constitution compliance

See `specs/001-solution-foundation/checklists/implementation.md` for Principles I-XI evidence, licenses, migration, no approval route, no sensitive marker, design delta, quickstart sign-off.

## License

MIT etc. - see `npm run license:check` allow-list.
