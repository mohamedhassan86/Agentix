# Phase 0 Research: Solution Foundation

**Feature**: [001-solution-foundation](./spec.md)  
**Date**: 2026-09-12

Every Technical Context choice is resolved. Exact patch versions are selected together in `package-lock.json` during implementation and must pass the license allow-list and build before acceptance.

## R-001 — Runtime and project shape

**Decision**: Scaffold one npm project on Node.js 22 LTS, strict TypeScript 5.x, Next.js 16.x App Router, and React 19.x. Use ECMAScript modules. The web app and worker are separate process entry points in the same source tree and package graph.

**Rationale**: The constitution fixes this stack and one-codebase hosting split. Next.js 16 supports Node 20.9+ and TypeScript 5.1+; Node 22 satisfies it. A single package avoids workspace/build complexity while dependency rules preserve architectural separation.

**Alternatives considered**:
- Multiple npm workspaces/packages for each layer — rejected because import rules, project references, and one build are sufficient at this scale.
- Separate backend framework — rejected because the constitution fixes Next.js route handlers for API and UI.
- Edge runtime — rejected for this slice because the native PostgreSQL adapter, worker, and complete telemetry SDK require the Node runtime.

**Sources**:
- Next.js 16 upgrade/runtime requirements: https://nextjs.org/docs/app/guides/upgrading/version-16
- Next.js 16 release: https://nextjs.org/blog/next-16

## R-002 — Dependency direction enforcement

**Decision**: Use TypeScript project configuration/path aliases for developer feedback and dependency-cruiser 18.x as the authoritative graph gate. Rules prohibit Domain imports outside Domain/standard TypeScript, Application imports from Infrastructure/App/Worker/React/Next/Prisma, App direct imports of Prisma/generated persistence, and all cycles. Include small negative fixtures that are excluded from production compilation but supplied to a gate test to prove each rule fails.

**Rationale**: Dependency-cruiser operates on TypeScript import graphs, supports Node 22, reports source and target, and is MIT licensed. It complements rather than replaces TypeScript/ESLint. A tested rule is stronger than a directory convention.

**Alternatives considered**:
- ESLint `no-restricted-imports` only — rejected because glob maintenance is fragile and graph cycles are harder to express.
- Nx or a monorepo build system — rejected as disproportionate to one application.
- Runtime dependency injection framework — rejected; architecture is enforced statically and composition remains explicit.

**Sources**:
- dependency-cruiser repository/docs: https://github.com/sverweij/dependency-cruiser
- Package license/current compatibility: https://www.npmjs.com/package/dependency-cruiser

## R-003 — Command/query dispatch

**Decision**: Implement a small in-process dispatcher in Application using explicit command/query symbols and a composition-root registry. One handler is registered per request type; duplicate/missing registration fails at startup. Dispatch accepts request context and `AbortSignal`. Do not add a CQRS/DI framework.

**Rationale**: The constitution ratifies in-process dispatch and permits a hand-written implementation. The required surface is small: typed request-to-result mapping, one handler, and cancellation. Explicit registration is visible, testable, and has no licensing or hidden-pipeline cost.

**Alternatives considered**:
- Dispatch library/framework — rejected because no advanced pipeline behavior is needed.
- Call handlers directly from route modules — rejected because it weakens the one-dispatch convention and duplicates context/error handling.
- Global service locator — rejected because tests and composition become implicit.

## R-004 — Validation, OpenAPI, and typed client

**Decision**: Define request and response schemas with Zod 4 in Application DTO modules. Register operation metadata with `@asteasolutions/zod-to-openapi` 8.x and generate OpenAPI 3.1 JSON into `contracts/openapi/agentix-v1.json`. The spec-local YAML is the planning baseline. CI regenerates to a temporary path and compares semantic JSON. A shared same-origin client accepts generated/inferred DTO types and validates response bodies in development/test.

**Rationale**: Zod provides runtime validation and inferred TypeScript types; zod-to-openapi supports Zod 4/OpenAPI 3.x and is MIT licensed. One schema source satisfies code-first contracts and avoids hand-written route fetch functions.

**Alternatives considered**:
- Hand-written OpenAPI as runtime source — rejected by the constitution's code-first requirement.
- Generate the whole server from OpenAPI — rejected because it introduces a router framework and obscures route-handler shape.
- Separate client types — rejected due drift.

**Sources**:
- zod-to-openapi Zod 4 support/license: https://github.com/asteasolutions/zod-to-openapi
- OpenAPI 3.1 specification: https://spec.openapis.org/oas/v3.1.0
- RFC 9457 Problem Details: https://www.rfc-editor.org/rfc/rfc9457.html

## R-005 — Correlation, error mapping, and CORS

**Decision**: Accept `X-Correlation-Id` only when it is a canonical UUID; otherwise generate UUID v7 via `uuid` 14.x. Attach it to request context, logger, active span, every response header, and Problem Details body. Use a closed Application error hierarchy (`Validation`, `DomainRule`, `NotFound`, `Conflict`, `Unavailable`, `Unexpected`) and one App error mapper. Unexpected errors return safe generic detail. CORS middleware permits same-origin by default and only exact configured origins; no wildcard with credentials.

**Rationale**: Canonical UUID validation prevents attacker-controlled oversized/free-form log fields. UUID v7 is sortable and the chosen package supports RFC 9562 v7 with zero dependencies under MIT. Central error/CORS handling keeps route modules branch-free.

**Alternatives considered**:
- Accept arbitrary request IDs — rejected due log injection/cardinality risk.
- Generate UUID v4 — valid but does not meet the constitution's sequential UUID preference.
- Per-route try/catch/CORS — explicitly forbidden.

**Sources**:
- `uuid` RFC 9562 v7 support/license: https://github.com/uuidjs/uuid
- OWASP REST security guidance: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html

## R-006 — PostgreSQL and Prisma baseline

**Decision**: Use PostgreSQL 16+, Prisma ORM 7.10.x, `@prisma/adapter-pg`, and `pg`. Configure explicit generated-client output outside Domain/Application. The initial additive migration creates only outbox, outbox-attempt, foundation-demo-request, and foundation-demo-effect tables plus constraints/indexes. App/Application interact through ports; Prisma and raw SQL stay in Infrastructure. Use migration deploy status in readiness and Testcontainers for integration tests.

**Rationale**: The constitution fixes PostgreSQL and a typed ORM. Prisma 7 is stable while Prisma 8 is still release-candidate as of the planning date. The native pg adapter supports ordinary TCP PostgreSQL across local and managed providers. PostgreSQL 16 matches the minimum and Testcontainers gives repeatable real constraint/locking behavior.

**Alternatives considered**:
- Prisma 8 release candidate — rejected for a foundation lockfile.
- Provider-specific serverless driver — rejected because it would tie the foundation to one database vendor.
- SQLite/in-memory integration tests — rejected because JSONB, constraints, locking, leases, and `SKIP LOCKED` behavior must be real.

**Sources**:
- Prisma Client extensions/current stable package line: https://www.npmjs.com/package/@prisma/client
- Prisma pg adapter: https://www.npmjs.com/package/@prisma/adapter-pg
- PostgreSQL 16 documentation: https://www.postgresql.org/docs/16/
- Testcontainers Node PostgreSQL package/license: https://www.npmjs.com/package/@testcontainers/postgresql

## R-007 — Transactional outbox and worker claim strategy

**Decision**: Use a PostgreSQL outbox polled every 1 second by default. Claim up to 10 due rows in a short transaction using an Infrastructure-only `UPDATE ... FROM (SELECT ... FOR UPDATE SKIP LOCKED)` statement, set `processing`, increment attempts, assign worker/lease expiry, commit, then process outside the claim transaction. Success sets `succeeded`; transient failure computes bounded exponential backoff with jitter and returns to `pending`; permanent or max-attempt failure sets `failed`. A reaper makes expired leases pending/failed before each claim cycle. Default max attempts is 3, base delay 1 s, cap 30 s, lease 30 s; all safe-bounded values are typed config.

Handlers receive `WorkContext { workId, idempotencyKey, scope, orgId, correlationId, attempt, signal }`. A unique effect/idempotency key prevents duplicate visible effects when a worker crashes after the effect but before acknowledgement. The process handles SIGTERM/SIGINT, stops claiming, aborts handlers, waits up to 30 seconds, and leaves leases recoverable.

**Rationale**: `SKIP LOCKED` is designed for queue-like access where concurrent consumers should skip claimed rows. PostgreSQL already participates in the application transaction, so the outbox avoids a database/broker dual write and external infrastructure. Leases handle crashes because row locks cannot be held during external work.

**Alternatives considered**:
- LISTEN/NOTIFY only — rejected because notification is not durable; it could be an optimization later over the same polling source of truth.
- Hold a database transaction while processing — rejected due long-lived locks/connections.
- Redis/RabbitMQ/SQS — rejected as extra infrastructure and still unable to atomically commit with PostgreSQL without an outbox.
- Delete rows on success — rejected because attempts/outcome must remain observable; retention can be introduced later.

**Sources**:
- PostgreSQL locking clause and `SKIP LOCKED`: https://www.postgresql.org/docs/16/sql-select.html#SQL-FOR-UPDATE-SHARE
- PostgreSQL explicit locking: https://www.postgresql.org/docs/16/explicit-locking.html

## R-008 — Work scope and tenant-ready fail-closed behavior

**Decision**: Model work scope as a closed `global | tenant` discriminator. A database check enforces global implies null `org_id`, tenant implies non-null `org_id`. Enqueue APIs require distinct constructors (`enqueueGlobal`, `enqueueForTenant`), not an optional tenant argument. Worker dispatch rejects payload/scope mismatch before a handler. Spec 001 uses only one allow-listed global demonstration work type; no tenant record exists.

**Rationale**: This prepares queue boundaries without pretending tenancy is implemented. Separate constructors and database checks prevent accidental unscoped tenant jobs when 002 arrives.

**Alternatives considered**:
- Nullable organization with no scope — rejected because null becomes ambiguous and can silently bypass tenancy.
- Create a placeholder organization table — rejected as 002 business scope.
- Ambient tenant context in worker — constitution explicitly forbids it.

## R-009 — Demonstration transaction and idempotency proof

**Decision**: `POST /api/v1/foundation/work` dispatches a command that creates one `foundation_demo_requests` marker and one global outbox item in the same transaction. The worker's only foundation handler inserts `foundation_demo_effects` using a unique `(work_id)` and marks the request completed. `GET /api/v1/foundation/work/{requestId}` reports queued/processing/succeeded/failed and an effect count. A caller-provided optional idempotency key is length-limited; otherwise the server creates one. Repeated same-key requests return the existing request.

This endpoint is enabled in local/test environments and in non-production review deployments only. Production returns 404 unless explicitly enabled by safe server config. It is never used to trigger a future domain operation.

**Rationale**: The spec requires reviewer-visible proof of atomic persistence, concurrency, retry, and correlation without inventing a customer concept or privileged future shortcut.

**Alternatives considered**:
- Test repository directly only — rejected because it does not prove route→dispatch→transaction→worker composition.
- Use a future invitation/run as the demo — rejected as scope leakage and potentially an approval bypass.
- Always expose in production — rejected because a diagnostic mutation surface has no customer value.

## R-010 — Structured logging and redaction

**Decision**: Use Pino 10.x with JSON stdout in app/worker. Construct child loggers from an explicit diagnostic context (`correlation_id`, optional `org_id/project_id/run_id/phase/agent`, `operation`, optional `work_id`). Configure path-based redaction for authorization/cookie/password/token/secret/key/connection fields and serializers that emit allow-listed error fields only. Never log request/response bodies by default. Tests use an in-memory sink and a unique marker in nested objects, URLs, errors, headers, and work payloads, then assert zero marker occurrences.

**Rationale**: Pino is mature, fast, and MIT licensed. Explicit serializers plus redaction are defense in depth; redaction alone cannot protect free-form messages, so code standards prohibit concatenating untrusted payloads.

**Alternatives considered**:
- `console` JSON — rejected due inconsistent context/serialization/redaction.
- Log every body then scrub — rejected because unknown fields and URLs can leak secrets.
- Vendor logging SDK — rejected to maintain provider neutrality.

**Sources**:
- Pino package/license: https://www.npmjs.com/package/pino
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

## R-011 — OpenTelemetry baseline

**Decision**: Initialize OpenTelemetry before app/worker composition using `instrumentation.ts` for Next.js and an explicit NodeSDK bootstrap for the worker. Install API, Node SDK, HTTP and pg auto-instrumentations, OTLP HTTP trace/metric exporters, and resource semantic conventions. Exporters are optional: no endpoint means local no-op/in-memory test exporters, not startup failure. Instrument dispatch, readiness, database/outbox claim, and work handling with low-cardinality attributes. Propagate W3C trace context through outbox metadata and link processing spans to enqueue context; still use application correlation ID for logs/API.

Baseline metrics: HTTP duration/count/failure, readiness state/duration, outbox claim/processing duration, work success/failure/retry, and oldest due-item age. Never use email, payload, URL query, arbitrary error detail, or UUIDs as metric labels.

**Rationale**: The constitution requires vendor-neutral logs/traces/metrics. OpenTelemetry is Apache-2.0 and its Node SDK supports standard exporters and test readers. Span context cannot rely on request-local ambient state across a durable boundary, so trace metadata is persisted explicitly.

**Alternatives considered**:
- Vendor APM — rejected due provider lock-in.
- Logs only — rejected because trace and metric requirements remain unmet.
- Persist entire trace headers/payload — rejected; only validated trace context fields are allowed.

**Sources**:
- OpenTelemetry JS: https://github.com/open-telemetry/opentelemetry-js
- Next.js OpenTelemetry guide: https://nextjs.org/docs/app/guides/open-telemetry
- OpenTelemetry Node SDK: https://open-telemetry.github.io/opentelemetry-js/modules/_opentelemetry_sdk-node.html

## R-012 — Health and readiness semantics

**Decision**: `GET /health/live` returns 200 whenever the web process can answer. `GET /health/ready` performs a bounded database query and verifies required migration state; it returns 200 ready or 503 Problem Details with only dependency category `database` or `schema`. The worker exposes health through structured heartbeat logs/metrics rather than another HTTP server in this slice; its process exit and telemetry indicate failed startup. `GET /api/v1/ping` runs through query dispatch and returns service, version, status, and current UTC time.

Health responses receive correlation headers, never cache, and never reveal hostnames, versions beyond public app version, stack traces, SQL, or connection details.

**Rationale**: Liveness must not restart a process merely because the database is temporarily down; readiness must stop traffic against unavailable or stale storage. A second worker HTTP server is unnecessary for the initial deployment contract.

**Alternatives considered**:
- One `/health` endpoint — rejected because orchestration cannot distinguish restart from traffic removal.
- Deep checks in liveness — rejected because dependency outage would cause restart loops.
- Public diagnostics dump — rejected as information leakage.

## R-013 — Configuration model

**Decision**: One server-only typed configuration module validates environment once per process and returns immutable sub-configs. Required: `DATABASE_URL`; production additionally requires `APP_ORIGIN`. Safe defaults: log level `info`, poll 1000 ms, batch 10, lease 30 s, max attempts 3, shutdown 30 s, demonstration route disabled in production, empty CORS allow-list (same-origin), telemetry exporter disabled. Bound numeric values and exact-origin URLs. Tests inject plain objects; Application/Domain never read `process.env`.

**Rationale**: Central validation provides fail-fast behavior and keeps secrets out of client modules. Conservative defaults allow local keyless operation.

**Alternatives considered**:
- Read environment throughout adapters — rejected due hidden dependencies and inconsistent validation.
- Commit `.env` defaults — rejected because connection strings/secrets cannot be committed.
- Public runtime configuration endpoint — rejected because no client setting is needed in the foundation.

## R-014 — UI tokens and font delivery

**Decision**: Copy canonical design variables from `Public/Desgin/index.html` into `src/app/globals.css`, including full state color families, radius, and sidebar width. Implement the minimum reusable classes needed by the temporary page using variables. Bundle Inter locally if an existing permissible asset is available during implementation; otherwise use the mock's system fallback stack and record that exact font-file delivery is deferred, avoiding runtime third-party font calls. Use Lucide React only if icons materially improve status; text remains sufficient without icons.

**Rationale**: The foundation establishes token names and accessibility defaults, not the full component catalog. Offline/local operation rules out a hard dependency on Google Fonts. The planned Design Delta makes the temporary page explicit.

**Alternatives considered**:
- Copy the whole 3,000-line design mock CSS — rejected as unused code and feature leakage.
- Hard-code colors per component — constitution violation.
- External font CDN — rejected for offline reproducibility and privacy.

## R-015 — Test strategy and coverage

**Decision**: Use Vitest 5.x with separate unit and integration projects, Testing Library/jsdom for page states, `@testcontainers/postgresql` 12.x for a shared-per-file PostgreSQL 16 container, and Playwright for one foundation page/accessibility smoke. Coverage uses V8 and scoped thresholds: 90% lines for any rule-bearing Domain files and 80% for Application; foundation shared errors/dispatch receive named branch tests. Integration tests run migrations exactly as deployment does and exercise Next route handlers through HTTP.

A test-policy script rejects `.skip`, `.only`, `todo`, and placeholder assertions outside allow-listed generated/vendor files. No snapshot may contain secrets. CI uses a PostgreSQL service for speed while Testcontainers remains the local canonical path; both apply the same migrations and tests.

**Rationale**: The constitution mandates Vitest and real PostgreSQL. Testing Library/Playwright cover state and browser accessibility. Vitest 5 and Testcontainers 12 support Node 22 and are MIT licensed.

**Alternatives considered**:
- Jest — constitution requires Vitest.
- Mocked repository integration tests — cannot prove SQL constraints/claims/migrations.
- Full browser suite in foundation — excessive before identity; one smoke validates the shell.

**Sources**:
- Vitest package/license: https://www.npmjs.com/package/vitest
- Testcontainers Node: https://node.testcontainers.org/
- Playwright: https://playwright.dev/

## R-016 — License gate

**Decision**: Use `license-checker-rseidelsohn` 5.x with an allow-only SPDX policy: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, and MPL-2.0. Unknown/custom/unlicensed dependencies fail. Keep a reviewed exceptions data file only for SPDX-equivalent metadata defects; each entry requires package/version, upstream license URL, reviewer, and expiry, and none is planned for 001. Scan production and development dependencies because CI/build tools execute code.

**Rationale**: The tool supports `--onlyAllow`, is BSD-3-Clause, and examines the installed dependency tree. An allow-list is safer than enumerating known copyleft licenses.

**Alternatives considered**:
- `npm audit` — vulnerability scanning does not enforce licenses.
- Deny-list only — misses unknown/new restrictive identifiers.
- SaaS scanner — violates keyless/no-paid dependency and is unnecessary here.

**Sources**:
- license-checker-rseidelsohn options/license: https://www.npmjs.com/package/license-checker-rseidelsohn

## R-017 — CI and deployment split

**Decision**: GitHub Actions runs on Node 22 with npm cache and PostgreSQL 16 service: `npm ci`, migration deploy/validation, `npm run lint`, `npm test`, `npm run build`, and `npm run license:check`. Individual scripts include architecture, test policy, contract drift, and integration suites so local and CI commands are identical. Upload test/coverage reports only when they contain no environment dumps.

Production shape: Next.js app on Vercel/equivalent Node host; worker as a long-running container using the same build artifact and `npm run worker`. A scheduled/finite worker mode may be added later for serverless cron but is not the primary 001 deployment because graceful polling and leases are naturally long-running.

**Rationale**: The repository is on GitHub and the constitution requires the hosting decision in 001. A container worker has predictable shutdown and polling semantics without constraining the web host.

**Alternatives considered**:
- Vercel request function as continuous worker — unsuitable for long polling and process signals.
- Separate worker repository/image source — violates same-codebase rule.
- CI-only custom commands — rejected because local/CI parity is required.

## R-018 — Optional enhancement commands

**Decision**: Record `/speckit-clarify` as skipped: no unresolved product ambiguity remains, and 001 has no customer authorization state machine, money rule, or UI deviation beyond the already explicit temporary Design Delta. Recommend `/speckit-checklist` after plan for architecture/outbox/redaction risk and `/speckit-analyze` after tasks because foundation contracts span multiple artifacts.

**Rationale**: The constitution classifies these as optional and requires an explicit skip reason, not ceremonial blocking.
