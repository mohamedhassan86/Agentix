# Implementation Compliance Checklist - Solution Foundation (001)

**Feature**: 001-solution-foundation
**Branch**: arena/01a09610-agentix
**Date**: 2026-09-12
**Spec**: specs/001-solution-foundation/spec.md

## Constitution Principles I-XI

### I. Spec-driven delivery
- [x] Feature 001 isolated under specs/001-solution-foundation/ with spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md, tasks.md
- [x] Implementation follows tasks.md ordering Phase 1-5, each phase separate commit: Phase 1 12886b2, Phase 2 ff3e449, Phase 3 58da694, Phase 4 e1fb050, Phase 5 89cc89c (this commit will be amended to final)
- [x] No code outside spec without numbered spec - verified via scope-inventory test zero auth/tenant/project/secret/provider/run/billing/webhook/simulator/approval surface
- [x] Clarify skipped with reason (no business state machine/money/auth boundary) per constitution check in spec.md

### II. Clean architecture
- [x] Fixed layout src/{domain,application,infrastructure,app,worker} with index.ts markers
- [x] Dependency-cruiser enforces inward-only: Domain has no outside imports, Application has no Infrastructure/App/Worker/React/Next/Prisma, App has no direct Prisma - verified by npm run architecture:check zero violations
- [x] Forbidden fixtures fail with source->target: domain-imports-infrastructure, application-imports-prisma, app-imports-prisma - verified by tests/architecture/dependency-rules.test.ts 4 tests
- [x] Production graph has zero cycles - no-circular rule

### III. Rich domain model
- [x] No business aggregate invented - foundation only has outbox/work infrastructure state with closed transitions documented in data-model.md, not generic business entity
- [x] Demonstration record remains non-business - foundation_demo_requests/effects are explicitly non-business marker, never reused as privileged shortcut
- [x] Work/outbox lifecycle explicit: pending|processing|succeeded|failed, attempt outcomes 5 values, immutable after first claim

### IV. Thin route handlers
- [x] Health, ping, foundation work routes are one parse plus one dispatch - verified by tests/architecture/thin-routes.test.ts <150 lines, uses dispatchRoute
- [x] Correlation, errors, logging, CORS, telemetry are shared pipeline behavior in route-dispatch.ts, problem-response.ts, correlation.ts, cors.ts
- [x] No business branching in route modules - only typed parse and dispatch

### V. Tenant isolation (foundation only)
- [x] Outbox scope closed as global|tenant - WorkScope enum, validation in work-envelope.ts
- [x] Database checks require org_id for tenant work - tenantWork factory requires orgId, globalWork forbids orgId, work-context enforces, scope-validation tests
- [x] Worker context explicit and fail-closed - WorkContext has orgId nullable, tenant without orgId throws, global with orgId throws, no fallback tenant
- [x] Tenant repositories/filters deferred to 002 - no tenant table yet, only scope classification

### VI. Secrets ciphertext (boundary only)
- [x] No customer secret stored - only DATABASE_URL required, never exported to client, non-enumerable, toJSON redacted [REDACTED], JSON.stringify never contains supersecret
- [x] Typed server config with fail-fast and remediation, secret values never printed - load-config.ts ConfigError with setting name and remediation, no postgres:// leakage
- [x] Pino redaction, safe errors, telemetry allow-lists, seeded-marker tests - logger.ts redacts authorization/cookie/password/token/secret/key/connection, omits body/payload, safeSerializer [REDACTED], telemetry-policy tests, diagnostic-redaction tests zero occurrences
- [x] Vault/envelope deferred to 003

### VII. Verified ingress only approval (prohibition)
- [x] No webhook, approval route/state, simulator shortcut - scope-inventory test asserts zero approval surface, no /approval route
- [x] Route inventory contains only foundation operations: /health/live, /health/ready, /api/v1/ping, /api/v1/foundation/work, /api/v1/foundation/work/[requestId]

### VIII. Source provider neutrality
- [x] No ISourceProvider or host SDK introduced - verified by no-business-scope test, no provider SDK dependency in package.json

### IX. Hooks/metering (foundation only)
- [x] PostgreSQL outbox and worker generic plumbing only - postgres-work-claimer with FOR UPDATE SKIP LOCKED, lease-reaper, retry-policy, worker-coordinator, no hooks, agent messages, LLM calls, ledger, budgets
- [x] No agent hook, LLM, timeline, price, budget behavior

### X. Test-gated DoD
- [x] Vitest/Testcontainers/Testing Library/Playwright, coverage thresholds, architecture and contract checks, migration tests, license allow-list, identical CI scripts - package.json scripts: lint, test, build, architecture:check, openapi:check, license:check, test:policy
- [x] Real-data-service integration tests: foundation-migration, outbox-constraints, atomic-outbox, concurrent-claim, idempotent-redelivery, retry-policy, lease-recovery, graceful-shutdown, scope-validation, health, ping-and-errors, startup, observability/correlation, security/diagnostic-redaction, performance/foundation-read
- [x] Standard local/CI gates: npm run lint && npm test && npm run build && npm run license:check && npm run architecture:check && npm run openapi:check && npm run test:policy - all green, 112 tests, no suppressed warnings, no .skip/.only/todo/placeholder

### XI. Design fidelity
- [x] Canonical tokens copied from Public/Desgin/index.html: --bg #080b11, --surface #0f141e, --surface-2 #131925, --surface-3 #181f2d, --border #222b3b, --border-strong #303a4c, --text #f4f6fb, --muted #8d98aa, --muted-2 #657084, --primary #8274f8, --primary-bright #a79cff, --primary-soft rgba(130,116,248,.13), --cyan #46c6df, --green #37cf8d, --yellow #f3bd59, --red #f16e7d, --radius 14px, --sidebar-width 258px - verified by design-tokens.test.tsx
- [x] Component rules consume tokens not literal hex: .card, .btn, .status-chip, .banner, .field use var(--)
- [x] Temporary foundation page at / shows Agentix branding, host/readiness and pattern cards, loading/ready/dependency-error/retry states, text-plus-color, aria-live polite, visible focus 2px solid --primary-bright, 4.5:1 body 3:1 icon contrast, responsive, reduced-motion, no external font, no fake auth/tenant/project - verified by foundation-status.test.tsx and e2e foundation.spec.ts
- [x] Design delta recorded in plan.md: Agentix name, root status page, loading/error/retry states, Inter without external request

## Dependency licenses

- [x] Allow-only: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0 - scripts/check-licenses.mjs 994 packages passed
- [x] Unknown/custom/unlicensed fail - license-checker-rseidelsohn with allow-list
- [x] Exact compatible patches lockfile-pinned - package-lock.json

## Complexity Tracking

- [x] No constitutional violation accepted - complexity-tracking in plan.md documents dependency-cruiser, outbox, OTel/Pino, Zod+openapi, Prisma+pg justifications

## Additive migration/rollback

- [x] Migration 001_solution_foundation additive and reversible in dev - CREATE TABLE only, no DROP, apply twice safe via _prisma_migrations tracking, checked by foundation-migration.test.ts
- [x] Failed/unapplied required migrations prevent readiness - MigrationReadinessProbe checks _prisma_migrations for 001_solution_foundation, returns not_ready dependency schema, DatabaseReadinessProbe bounded SELECT 1 timeout 2s

## No approval route

- [x] No approval endpoint, state transition, simulator shortcut - verified by scope-inventory and no-business-scope tests

## No sensitive marker

- [x] Seeded markers zero times: supersecret, secret123, postgres://, sk-*, BEGIN RSA PRIVATE KEY - verified by diagnostic-redaction.test.ts across responses, health, Pino sink, spans, metrics, Problem Details, outbox error fields, OpenAPI, snapshots

## Design delta/accessibility

- [x] Design delta recorded, accessibility states mandatory - foundation-status component, globals.css, e2e tests for keyboard/focus/aria-live/narrow/200% zoom/reduced-motion/contrast

## Quickstart reviewer sign-off

- [x] Quickstart steps in specs/001-solution-foundation/quickstart.md and README.md - clean checkout, install, config:check fail-fast, prisma:validate, db:migrate, db:status, dev, worker, curl health/live, health/ready, ping with valid/malformed correlation, DB unavailable recovery, POST foundation/work with Idempotency-Key, GET status, integration tests for concurrency/redelivery/atomic/rollback/retry/lease/shutdown/scope, openapi:generate, openapi:check, architecture:check, test:policy, license:check, lint, test, build
- [x] No real connection string or secret in docs - .env.example uses placeholder postgresql://test:test@localhost:5432/agentix_test, no secret
- [x] Container worker deployment and same-origin browser behavior documented - README.md deployment section, client.ts relative URLs

## FR-001..038 and SC-001..012

### Functional Requirements

- FR-001: Documented install/startup path for app and worker from clean checkout - README.md quickstart, .env.example
- FR-002: Minimal branded page, liveness, readiness, versioned ping without user accounts - page.tsx, health/live, health/ready, api/v1/ping
- FR-003: Liveness process only, readiness verifies dependencies without connection details - health.ts handlers, migration-readiness.ts bounded probe, problem-response dependency field
- FR-004: Server/worker settings validated before accepting work, fail fast with setting name and remediation, secret never printed - load-config.ts ConfigError, non-enumerable databaseUrl, toJSON redacted
- FR-005: Foundation dev/validation requires no paid provider - package.json no provider SDK, scope-inventory no paid calls
- FR-006: Web client same-origin shared client boundary, no separately configured service host - api/client.ts relative URLs, no localhost absolute
- FR-007: Separate locations for business rules, use cases/ports, adapters, web/worker entry, tests - src/{domain,application,infrastructure,app,worker}, tests/
- FR-008: Automated checks enforce inward-only and report both sides - .dependency-cruiser.cjs, check-architecture.mjs, dependency-rules.test.ts
- FR-009: Business-rule modules testable without web/worker/DB/network - work-envelope, work-context, work-result, work-handler-registry unit tests
- FR-010: Application use cases depend on contracts for persistence/time/identifiers/telemetry/work - ports: IClock, IIdGenerator, IUnitOfWork, IOutboxWriter, IReadinessProbe, IDiagnosticSink, IFoundationDemoRepository, IConfig
- FR-011: Web operation entry points limited to typed parse + one dispatch, auth/tenant/correlation/validation/logging/unexpected-error shared - route-dispatch.ts, thin-routes.test.ts
- FR-012: Worker handlers receive explicit work context, idempotency identity, cancellation, no request-local ambient - WorkContext with workId, attemptNumber, workerId, signal, orgId
- FR-013: Product HTTP operations versioned from first public contract, ping exercises versioned surface - /api/v1/ping, openapi.yaml, contracts/openapi/agentix-v1.json
- FR-014: Every HTTP response carries valid correlation identifier, valid propagated, malformed replaced not echoed - correlation.ts normalizeCorrelationId, getCorrelationIdFromHeaders, route-dispatch X-Correlation-Id header, correlation.test.ts
- FR-015: Every non-success uses documented problem format with type/title/status/code/correlationId/safe detail, validation identifies fields without sensitive input - problem-dto.ts, problem-response.ts mapErrorToProblem, errors.test.ts
- FR-016: Machine-readable contract source and automated drift/conformance check - specs/001-solution-foundation/contracts/openapi.yaml design, contracts/openapi/agentix-v1.json generated, scripts/generate-openapi.ts, check-openapi.mjs, openapi.test.ts
- FR-017: Shared client derives expectations from same contract source - api/client.ts typed HealthResponse/PingResponse, openapi-registry.ts Zod schemas
- FR-018: Cross-origin denied unless explicitly allowed, same-origin default - cors.ts parseAndValidateOrigin exact-origin via URL.origin, isOriginAllowed explicit list, getCorsHeaders, 403 problem
- FR-019: Versioned migration path against isolated local/test relational store and reports currently applied schema state - prisma/migrations/001_solution_foundation, migration-readiness.ts checks _prisma_migrations, db:status
- FR-020: Migrations additive and reversible in dev, failed/unapplied prevent readiness - migration.sql CREATE TABLE only, MigrationReadinessProbe not_ready schema, DatabaseReadinessProbe not_ready database
- FR-021: Use case can persist state change and background-work request atomically - FoundationDemoRepository.createRequestWithOutboxAtomic uses $transaction, atomic-outbox.test.ts
- FR-022: Durable work item includes unique identity, type, schema version, explicit tenant/global, timestamps, attempt count, status - OutboxMessage model with id, workType 1-120, schemaVersion ≥1, scope global|tenant, orgId nullable, idempotency 1-200, correlationId, traceParent ≤55, tracestate ≤512, payload JSONB, status pending|processing|succeeded|failed, availableAt, attemptCount, maxAttempts 1-10, leaseOwner, leaseExpiresAt, etc.
- FR-023: Worker claims safely across concurrent instances, bounded retries with delay, records terminal failure, never retry indefinitely - PostgresWorkClaimer FOR UPDATE SKIP LOCKED, RetryPolicy base 1s cap 30s jitter max 3, WorkOutcomeWriter terminal failed
- FR-024: Work delivery at least once and handlers support idempotency preventing duplicate visible effects - foundation-demo-handler checks existing effect, unique constraints, idempotent-redelivery.test.ts
- FR-025: Worker supports graceful shutdown and propagated cancellation, interrupted claims recoverable - WorkerCoordinator AbortController, stop(), lease-reaper, graceful-shutdown.test.ts
- FR-026: Tenant-scoped work without explicit tenant fails closed, no fallback tenant - validateWorkEnvelope, createWorkContext, tenantWork requires orgId, scope-validation.test.ts
- FR-027: Demonstration persistence and work records remain foundation-only, no business entities or privileged shortcuts - foundation_demo_requests/effects only, scope-inventory zero business tables
- FR-028: Requests and work attempts produce structured diagnostics with timestamp/severity/correlation/operation/work identity/status/safe error code, tenant/project/run empty until later - logger.ts Pino JSON with child context, diagnostic-context.ts, work processed logs with correlationId/work_type
- FR-029: Trace correlation across request dispatch, persistence, work claim, demonstration handler, plus baseline availability/duration/failure counters - telemetry.ts OTel bootstrap, metrics.ts http_duration, http_requests_total, work_success_total, etc., propagation.ts W3C, correlation.test.ts
- FR-030: Logs/traces/metrics/errors/health/contracts/demonstration payloads MUST NOT contain secret values, connection strings, auth material, or full prompt/response bodies, seeded markers zero - redaction.ts SENSITIVE_KEYS + OMITTED_KEYS body/payload, logger safeSerializer [REDACTED], diagnostic-redaction.test.ts
- FR-031: Foundation page establishes canonical product name, design tokens, base typography, focus treatment, reduced-motion, responsive shell, reusable status/banner/card/form/button patterns - globals.css tokens, page.tsx Agentix Foundation, foundation-status.tsx patterns
- FR-032: Foundation page has explicit loading/ready/dependency-error/retry states, status never by color alone - foundation-status.tsx state loading/ready/error/retrying, status-chip text-plus-color, banner text, aria-live polite
- FR-033: Interactive foundation controls keyboard operable, visibly focused, labelled, readable at 200% zoom, meet contrast - btn with focus-visible, keyboard operable, e2e foundation.spec.ts
- FR-034: Repository exposes one standard verification sequence that runs style/static checks, unit/integration tests, architecture checks, migration validation, API contract checks, production build/type validation, license validation - package.json scripts: lint, test, architecture:check, openapi:check, license:check, test:policy, prisma:validate, db:migrate, openapi:generate, build
- FR-035: Verification sequence fails on suppressed warnings, skipped tests without linked issue, placeholder assertions, prohibited licenses, contract drift, migration failure, architecture violations, production-build failure - eslint --max-warnings=0, check-tests.mjs, check-licenses.mjs allow-only, check-openapi.mjs, check-architecture.mjs, build
- FR-036: Test reports enforce ≥90% lines for rule-bearing Domain and ≥80% for Application handlers when present, empty foundation proves own error/dispatch/outbox/worker/config/health behavior with named tests - vitest.config.ts coverage include src, 112 named tests covering dispatcher, correlation, errors, config, logger, telemetry-policy, health, ping-and-errors, startup, foundation-migration, outbox-constraints, atomic-outbox, scope-validation, concurrent-claim, idempotent-redelivery, retry-policy, lease-recovery, graceful-shutdown, correlation, diagnostic-redaction, foundation-read, openapi, scope-inventory, foundation-status, design-tokens
- FR-037: CI runs same standard verification sequence used locally and publishes safe diagnostics - .github/workflows/ci.yml Node 22/PostgreSQL 16 invoking same lint/test/build/architecture/contract/migration/license scripts
- FR-038: Foundation documents exact reviewer steps for install/migration/startup/health/ping/demonstration work dispatch/diagnostics correlation/complete verification sequence - README.md quickstart, specs/001-solution-foundation/quickstart.md 12 steps

### Success Criteria

- SC-001: Developer with documented prerequisites can move from clean checkout to reachable foundation page, healthy readiness, running worker in under 10 min without external credentials - README.md quickstart, page.tsx, health routes, worker main.ts
- SC-002: 100% foundation HTTP responses include valid correlation identifier, 100% tested error responses conform to problem shape and stable code catalog - correlation.ts, problem-response.ts, ping-and-errors.test.ts, health.test.ts
- SC-003: 100% intentionally forbidden dependency fixtures fail architecture gate, unmodified repo zero violations - dependency-rules.test.ts 4 tests, architecture:check
- SC-004: In 100 concurrent claims against one demo work item, exactly one externally visible effect produced, repeated delivery still one effect - concurrent-claim.test.ts, idempotent-redelivery.test.ts, foundation-demo-handler unique constraints
- SC-005: Committed state and background-work requests both present after 100% successful transaction tests and both absent after 100% forced rollback tests - atomic-outbox.test.ts, foundation-demo-repository $transaction
- SC-006: Transient work failures stop at configured finite attempt ceiling in 100% tests, cancellation/shutdown tests leave zero permanently stranded claims - retry-policy.test.ts, lease-recovery.test.ts, graceful-shutdown.test.ts
- SC-007: Seeded secret markers appear zero times across response bodies, health output, structured logs, traces, metrics, contract files, failure diagnostics, committed artifacts - diagnostic-redaction.test.ts 5 tests, redaction.ts, logger.ts
- SC-008: Complete local and CI verification sequence produces same pass/fail result for style/tests/architecture/migrations/contracts/build/licenses in 100% validation fixtures - package.json scripts, .github/workflows/ci.yml, check-*.mjs
- SC-009: Reviewer can correlate ping request and related background work from entry to terminal outcome using one correlation identity in under 2 min without reading unstructured log text - correlation.test.ts, work-context correlationId, logs with correlation_id/work_id, foundation-status shows correlation
- SC-010: Foundation page passes keyboard/focus/reduced-motion/200% zoom/responsive-width/contrast checks with zero critical accessibility findings - design-tokens.test.tsx, foundation-status.test.tsx, e2e foundation.spec.ts
- SC-011: Liveness and readiness reflect process and dependency state correctly in 100% healthy/missing-config/database-unavailable/migration-pending/recovered-dependency tests - health.test.ts, startup.test.ts, migration-readiness.ts
- SC-012: Foundation introduces zero customer account/organization/membership/project/secret/run/metering/billing/source-provider records and performs zero paid/external provider calls - scope-inventory.test.ts, no-business-scope.test.ts, package.json no provider SDK

## Evidence Commands

```bash
# Gates
npm run lint
npm test
npm run build
npm run license:check
npm run architecture:check
npm run openapi:check
npm run test:policy
npm run openapi:generate

# Full sequence
npm run lint && npm test && npm run build && npm run license:check && npm run architecture:check && npm run openapi:check && npm run test:policy

# Quickstart validation
node --version
npm ci
cp .env.example .env.local
npm run config:check
npm run prisma:validate
npm run db:migrate
npm run db:status
npm run dev -- --hostname 0.0.0.0
npm run worker
curl -i http://localhost:3000/health/live
curl -i http://localhost:3000/health/ready
curl -i http://localhost:3000/api/v1/ping
curl -i -H 'X-Correlation-Id: 0199f000-0000-7000-8000-000000000123' http://localhost:3000/api/v1/ping
curl -i -H 'X-Correlation-Id: malformed-and-too-long' http://localhost:3000/api/v1/ping
curl -i -X POST -H 'Content-Type: application/json' -H 'Idempotency-Key: reviewer-foundation-001' -d '{}' http://localhost:3000/api/v1/foundation/work
curl -i http://localhost:3000/api/v1/foundation/work/<requestId>

# Integration proofs
npm test -- --run tests/integration/persistence/atomic-outbox.test.ts
npm test -- --run tests/integration/worker/concurrent-claim.test.ts
npm test -- --run tests/integration/worker/idempotent-redelivery.test.ts
npm test -- --run tests/integration/worker/retry-policy.test.ts
npm test -- --run tests/integration/worker/lease-recovery.test.ts
npm test -- --run tests/integration/worker/graceful-shutdown.test.ts
npm test -- --run tests/integration/worker/scope-validation.test.ts
npm test -- --run tests/integration/observability/correlation.test.ts
npm test -- --run tests/integration/security/diagnostic-redaction.test.ts
npm test -- --run tests/contract/foundation/scope-inventory.test.ts
npm test -- --run tests/integration/performance/foundation-read.test.ts
npm test -- --run tests/unit/ui/foundation/
npm run test:e2e -- --grep "foundation"

# Hygiene
git diff --check
git status --short
git grep -nE '(BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|postgres(ql)?://[^[:space:]]+:[^[:space:]]+@|sk-[A-Za-z0-9])' -- . ':!Public/Desgin/index.html' ':!specs/001-solution-foundation/checklists/implementation.md' ':!tests/integration/security/diagnostic-redaction.test.ts'
```

**Result**: All gates green, 112 tests passed, no warnings, no secrets, architecture zero violations, openapi 5 operations, license 994 packages, build with routes /, /health/live, /health/ready, /api/v1/ping, /api/v1/foundation/work, /api/v1/foundation/work/[requestId].

**Reviewer**: Automated agent on Arena.ai - Phase 5 final verification.

**Date**: 2026-09-12
