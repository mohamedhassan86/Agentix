# Quickstart Validation: Solution Foundation

**Feature**: [001-solution-foundation](./spec.md)  
**Contract**: [contracts/openapi.yaml](./contracts/openapi.yaml)  
**Model**: [data-model.md](./data-model.md)

This is the reviewer-run validation guide for the implemented feature. It contains expected commands and outcomes, not implementation code.

## 1. Prerequisites

- Node.js 22 LTS and npm
- Docker capable of running PostgreSQL 16, or an isolated PostgreSQL 16+ database
- `curl`
- No source-host, mailbox, cloud KMS, LLM, payment, or other paid-provider credentials

Confirm:

```bash
node --version
npm --version
```

Expected: Node reports major version 22.

## 2. Install and configure safely

```bash
npm ci
cp .env.example .env.local
```

Set only the documented local database URL and safe non-secret switches. `.env.local` must already be ignored by Git. Do not paste production credentials.

Validate fail-fast configuration without printing values:

```bash
npm run config:check
```

Expected: valid config passes. Temporarily omit the database setting and rerun: the command names `DATABASE_URL` and remediation, exits non-zero, and never prints its value. Restore valid local config.

## 3. Start PostgreSQL and apply the foundation migration

Use the repository's documented database helper if present, or start the documented PostgreSQL 16 container. Then run:

```bash
npm run prisma:validate
npm run db:migrate
npm run db:status
```

Expected:

- migration `001_solution_foundation` applies once;
- status reports current schema;
- applying deploy again is safe;
- only outbox/attempt and foundation demonstration tables exist—no user, organization, membership, project, secret, run, ledger, billing, or provider tables.

## 4. Start the web application and worker

Terminal 1:

```bash
npm run dev -- --hostname 0.0.0.0
```

Terminal 2:

```bash
npm run worker
```

Expected:

- both processes start without outbound provider calls;
- worker announces readiness using structured JSON metadata, not free-form credentials;
- app is reachable at the documented local URL;
- root renders the Agentix Foundation page.

## 5. Validate liveness, readiness, ping, and correlation

```bash
curl -i http://localhost:3000/health/live
curl -i http://localhost:3000/health/ready
curl -i http://localhost:3000/api/v1/ping
curl -i -H 'X-Correlation-Id: 0199f000-0000-7000-8000-000000000123' \
  http://localhost:3000/api/v1/ping
curl -i -H 'X-Correlation-Id: malformed-and-too-long' \
  http://localhost:3000/api/v1/ping
```

Expected:

- all healthy responses are 200 and match [OpenAPI](./contracts/openapi.yaml);
- liveness status is `alive`, readiness is `ready`, ping is `ok`;
- all responses include `X-Correlation-Id`;
- the valid canonical UUID is propagated;
- malformed input is replaced by a new canonical UUID and not echoed;
- health/status responses use `Cache-Control: no-store`;
- no database host/name/version, SQL, stack, or connection details appear.

Stop PostgreSQL while leaving the app running:

- liveness remains 200;
- readiness becomes 503 with `application/problem+json`, a stable code, matching correlation ID, and dependency category `database`;
- ping behavior follows its documented dependency needs;
- restoring PostgreSQL returns readiness to 200 without restarting the app.

## 6. Prove atomic work and idempotency

With the worker running and demonstration operations enabled for local development:

```bash
curl -i -X POST \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: reviewer-foundation-001' \
  -d '{}' \
  http://localhost:3000/api/v1/foundation/work
```

Follow the returned same-origin `Location` until terminal status:

```bash
curl -i http://localhost:3000/api/v1/foundation/work/<requestId>
```

Expected:

- first create returns 202; same idempotency key returns 200 and the same request/work IDs;
- terminal status becomes `succeeded`;
- `effectCount` is exactly 1 regardless of repeated status reads or forced message redelivery;
- response contains no work payload, database record, stack, or secret setting.

Run the integration concurrency proof:

```bash
npm test -- --run tests/integration/worker/concurrent-claim.test.ts
npm test -- --run tests/integration/worker/idempotent-redelivery.test.ts
npm test -- --run tests/integration/persistence/atomic-outbox.test.ts
```

Expected:

- 100 concurrent claims of one item produce exactly one effect;
- crash-after-effect simulation and redelivery retain one effect;
- forced transaction rollback leaves neither demonstration request nor outbox row;
- successful transaction leaves both.

## 7. Prove retries, lease recovery, and shutdown

```bash
npm test -- --run tests/integration/worker/retry-policy.test.ts
npm test -- --run tests/integration/worker/lease-recovery.test.ts
npm test -- --run tests/integration/worker/graceful-shutdown.test.ts
npm test -- --run tests/integration/worker/scope-validation.test.ts
```

Expected:

- transient failures schedule bounded delayed retries and stop at maximum attempts;
- expired processing leases recover without a permanently stranded item;
- SIGTERM/SIGINT stop claims, propagate cancellation, and exit within the configured bound or leave recoverable leases;
- tenant work with missing `orgId`, global work with an `orgId`, unknown handler versions, and malformed payloads fail before work handler execution;
- persisted/logged failures contain stable codes only.

## 8. Validate contracts and architecture

```bash
npm run openapi:generate
npm run openapi:check
npm run architecture:check
npm run test:policy
```

Expected:

- generated `contracts/openapi/agentix-v1.json` semantically matches the committed contract;
- live response tests conform to schemas/content types/status codes;
- all production imports obey Domain ← Application ← Infrastructure/App/Worker;
- no cycle or App/Application Prisma import exists;
- negative fixtures prove each forbidden edge fails;
- no `.skip`, `.only`, unlinked `todo`, or placeholder assertion is present.

Verify the route inventory contains no authentication, tenant business, provider, secret, run, billing, metering, webhook, simulator, or approval operation.

## 9. Validate telemetry and zero leakage

```bash
npm test -- --run tests/integration/observability
npm test -- --run tests/integration/security/diagnostic-redaction.test.ts
```

Expected:

- request, dispatch, database, enqueue, claim, and handler spans correlate;
- worker processing carries validated trace linkage and the same application correlation ID;
- baseline counters/durations use bounded attributes;
- UUIDs, payload values, query strings, idempotency keys, and errors are not metric labels;
- a seeded sensitive marker appears zero times in responses, health output, logs, traces, metrics, Problem Details, contracts, persisted error fields, and snapshots;
- logs are valid JSON with explicit null/absent future tenant/project/run dimensions and no full request/work payload.

## 10. Validate foundation page and accessibility

```bash
npm test -- --run tests/unit/ui/foundation
npm run test:e2e -- --grep "foundation"
```

Inspect desktop, narrow viewport, keyboard-only, 200% zoom, and reduced-motion modes.

Expected:

- Agentix branding and canonical design tokens are present;
- loading, ready, dependency-error, and retry states work;
- state always includes text, not color alone;
- retry is labelled, keyboard operable, visibly focused, and announces status politely;
- no runtime external font request occurs;
- body text contrast ≥4.5:1 and icons/large text ≥3:1;
- reduced motion disables all transitions/animations;
- no horizontal loss of primary action at 200% zoom/narrow width;
- no fake sign-in, organization, project, agent, run, billing, or approval control appears.

## 11. License and full quality gates

```bash
npm run license:check
npm run lint
npm test
npm run build
```

Expected:

- only MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, and MPL-2.0 dependency expressions are accepted;
- unknown/custom/unlicensed dependencies fail;
- all checks pass with no suppressed warning or skipped test;
- production build type-checks app and worker;
- coverage reports enforce constitution floors where applicable.

CI must execute the same scripts with the same results.

## 12. Repository hygiene and reviewer sign-off

```bash
git diff --check
git status --short
git grep -nE '(BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|postgres(ql)?://[^[:space:]]+:[^[:space:]]+@|sk-[A-Za-z0-9])' -- . ':!Public/Desgin/index.html'
```

Expected:

- only intentional feature files;
- no `.env`, build output, database dump, coverage output, container volume, credentials, or sensitive marker;
- reviewer can trace ping plus demonstration work in under 2 minutes by correlation ID;
- a reviewer other than the author records this quickstart as verified before feature completion.
