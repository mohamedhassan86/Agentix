---

description: "Dependency-ordered implementation tasks for the Agentix solution foundation"
---

# Tasks: Solution Foundation

**Input**: Design documents from `/specs/001-solution-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required. The specification and constitution require named unit, integration, contract, UI, concurrency, migration, architecture, redaction, and browser tests. Within each story, write tests first and verify they fail for the intended reason before implementation.

**Organization**: Tasks are grouped into five implementation phases (each ≤10 tasks) to satisfy Constitution Principle I. The three P1 stories share Phase 3 but retain separate story-labelled subsections and independent checkpoints. Every phase ends with `npm run lint`, `npm test`, `npm run build`, and `npm run license:check`; a red gate blocks the next phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after the preceding unmarked dependency in the same phase, because it owns different files.
- **[Story]**: Maps implementation work to US1–US5 from [spec.md](./spec.md).
- Every task names concrete repository paths.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize one reproducible Node/Next.js project, toolchain, fixed layer roots, and CI-facing scripts without adding feature behavior.

- [x] T001 Create the Node 22 ESM project and pin the plan-approved runtime/dev dependency graph and scripts in `package.json`, `package-lock.json`, and `.nvmrc`; set `engines.node` to Node 22 and add no provider SDK, auth stack, broker, or business dependency.
- [x] T002 Configure strict TypeScript and the Next.js 16 App Router build with layer aliases in `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, and `src/{domain,application,infrastructure,app,worker}/index.ts`; ensure Domain has no runtime import and both app/worker type-check from one codebase.
- [x] T003 [P] Configure zero-warning linting and source/test ignores in `eslint.config.mjs` and `.gitignore`, including `.env*` (except `.env.example`), generated Prisma client, `.next`, coverage, Playwright output, local database data, and build artifacts.
- [x] T004 [P] Configure Vitest 5 unit/integration/UI projects, V8 coverage floors, deterministic timeouts, and shared test setup in `vitest.config.ts`, `tests/setup/unit.ts`, `tests/setup/integration.ts`, and `tests/setup/ui.ts`; enforce ≥90% lines for rule-bearing Domain and ≥80% for Application handlers when present.
- [x] T005 [P] Configure Playwright's foundation browser project, local web server command, desktop/narrow/200%-zoom/reduced-motion targets, and artifact-on-failure policy in `playwright.config.ts` and `tests/e2e/.gitkeep`.
- [x] T006 [P] Define dependency-cruiser layer/cycle rules and forbidden-edge fixtures in `.dependency-cruiser.cjs` and `tests/architecture/fixtures/{domain-imports-infrastructure,application-imports-prisma,app-imports-prisma}.ts`; exclude fixtures from production compilation.
- [x] T007 [P] Add initial CI and policy command shells in `.github/workflows/ci.yml`, `scripts/check-licenses.mjs`, `scripts/check-tests.mjs`, and `scripts/check-openapi.mjs`; CI uses Node 22/PostgreSQL 16 and invokes the same `lint`, `test`, `build`, architecture, contract, migration, and license scripts as local development.

**Phase gate**: `npm run lint && npm test && npm run build && npm run license:check` passes before Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared Application contracts, dispatcher, safe configuration/diagnostics, persistence baseline, and route composition used by every story.

**⚠️ CRITICAL**: No story implementation starts until this phase is green.

- [x] T008 [P] Write failing unit tests for one-handler dispatch, duplicate/missing registration, propagated `AbortSignal`, closed error codes, and UUID correlation normalization in `tests/unit/application/dispatcher.test.ts`, `tests/unit/application/errors.test.ts`, and `tests/unit/application/correlation.test.ts`.
- [x] T009 [P] Write failing unit tests for fail-fast immutable config, bounded worker settings, exact-origin CORS parsing, secret-value omission, nested Pino redaction, and telemetry attribute allow-lists in `tests/unit/infrastructure/config.test.ts`, `tests/unit/infrastructure/logger.test.ts`, and `tests/unit/infrastructure/telemetry-policy.test.ts`.
- [x] T010 Implement the framework-free dispatcher, request context, UUID-v7 correlation factory, safe error hierarchy, Problem DTO, and shared ports (`IClock`, `IIdGenerator`, `IUnitOfWork`, `IOutboxWriter`, `IReadinessProbe`, `IDiagnosticSink`) in `src/application/shared/{dispatch,context,errors,ports}/`; keep Application imports limited to Domain/standard TypeScript.
- [x] T011 Implement one immutable server/worker config loader and safe defaults in `src/infrastructure/config/{schema.ts,load-config.ts,index.ts}` plus `.env.example`: `DATABASE_URL` required, production `APP_ORIGIN` required, exact CORS origins, poll 1000 ms, batch 10, lease 30 s, max attempts 3 (bounded 1–10), shutdown 30 s, and production demo disabled; never export values to client code.
- [x] T012 [P] Implement Pino JSON logging with child diagnostic context and recursive serializers/redaction in `src/infrastructure/observability/{logger.ts,redaction.ts,diagnostic-context.ts}`; omit request/work bodies and redact authorization, cookie, password, token, secret, key, and connection fields, storing/logging stable error codes rather than free-form exception details.
- [x] T013 [P] Implement vendor-neutral OpenTelemetry bootstrap and bounded metric/span attributes in `src/infrastructure/observability/{telemetry.ts,metrics.ts,propagation.ts}` and `src/instrumentation.ts`; support optional OTLP exporters, in-memory test exporters, graceful shutdown, and validated W3C context without UUID/payload/error values as metric labels.
- [x] T014 Create `outbox_messages`, `outbox_attempts`, `foundation_demo_requests`, and `foundation_demo_effects` in `prisma/schema.prisma` and `prisma/migrations/*_001_solution_foundation/migration.sql` with the exact [data-model.md](./data-model.md) limits: work type 1–120, schema version ≥1, scope `global|tenant` with null/non-null `org_id` equivalence, idempotency key 1–200 unique by type/scope/coalesced owner, traceparent ≤55, tracestate ≤512, payload object ≤64 KiB at Application boundary, status `pending|processing|succeeded|failed`, attempts `0..max` and max `1..10`, processing-only lease fields, terminal-only completion, attempt outcomes closed to five values, unique `(outbox_id,attempt_number)`, and unique demo effect by request/work; add due, lease, tenant-leading, correlation, and terminal indexes.
- [x] T015 Implement Prisma/pg creation, migration-state/readiness probe, UUID/clock adapters, and transaction wrapper in `src/infrastructure/persistence/{prisma.ts,pg.ts,migration-readiness.ts,unit-of-work.ts,id-generator.ts,clock.ts}`; generated ORM types stay outside Domain/Application and all raw SQL remains Infrastructure-only.
- [x] T016 Implement the shared App composition/error/correlation/CORS response pipeline and OpenAPI registry shell in `src/app/lib/{composition-root.ts,route-dispatch.ts,problem-response.ts,correlation.ts,cors.ts,openapi-registry.ts}`; wrappers return `X-Correlation-Id` on success/error and route modules remain one parse plus one dispatch.

**Phase gate**: Run all four mandatory gates. Verify T008/T009 now pass, migration applies twice safely, and architecture fixtures fail only when intentionally invoked.

---

## Phase 3: P1 Vertical Slices — Runnable Host, Architecture, and HTTP Baseline

**Purpose**: Deliver US1, US2, and US3 as independently testable P1 capabilities while keeping this implementation phase at 10 tasks.

### User Story 1 — Run the product skeleton locally

**Goal**: Start the web app and worker keylessly; render the Agentix foundation page; report correct liveness/readiness and safe configuration failures.

**Independent Test**: From clean setup, start app/worker without provider credentials, load `/`, receive 200 alive/ready when PostgreSQL is available, retain liveness and receive safe 503 readiness when it is unavailable, and observe fail-fast config without value leakage.

- [x] T017 [P] [US1] Write failing API/startup tests for liveness, database/schema readiness and recovery, cache headers, safe dependency errors, missing configuration, and keyless app/worker startup in `tests/integration/api/foundation/health.test.ts` and `tests/integration/app/startup.test.ts`.
- [x] T018 [P] [US1] Write failing UI tests for Agentix branding and loading/ready/database-error/retry states with text-plus-color status and polite announcements in `tests/unit/ui/foundation/foundation-status.test.tsx`.
- [x] T019 [US1] Implement liveness/readiness Application queries and thin route modules in `src/application/foundation/{queries,handlers,dto}/health.ts`, `src/app/health/live/route.ts`, and `src/app/health/ready/route.ts`; liveness has no dependency check, readiness uses the bounded 2 s database/schema probe and returns no connection detail.
- [x] T020 [US1] Implement the temporary server-rendered Agentix foundation page and focused retry client component in `src/app/page.tsx`, `src/app/layout.tsx`, and `src/app/components/foundation/foundation-status.tsx`; include only foundation status/pattern content and no fake auth, tenant, project, provider, run, billing, simulator, or approval control.
- [x] T021 [US1] Implement worker startup, typed config/readiness check, structured heartbeat, signal wiring, and telemetry shutdown without work claiming yet in `src/worker/{main.ts,composition-root.ts,shutdown.ts}`; bind no extra HTTP server and make absent database/migration prevent worker readiness safely.

**US1 checkpoint**: Startup/health/UI tests pass and a clean checkout reaches the status page in under 10 minutes.

### User Story 2 — Add a vertical slice without crossing boundaries

**Goal**: Make architecture direction and the thin-route rule mechanically enforceable.

**Independent Test**: Production graph passes with zero violations; each forbidden fixture fails with the expected source and target; Domain/Application unit tests require no web, worker, database, or network.

- [x] T022 [P] [US2] Write the architecture conformance harness and thin-route/source inventory assertions in `tests/architecture/dependency-rules.test.ts`, `tests/architecture/thin-routes.test.ts`, and `tests/architecture/no-business-scope.test.ts`; prove each negative fixture fails and the production graph has no cycle/reverse/layer-skip import.
- [x] T023 [US2] Wire dependency-cruiser, TypeScript project checks, thin-route inspection, and actionable source→target reporting into `scripts/check-architecture.mjs` and `package.json`; prohibit Domain framework/ORM/UI imports, Application Infrastructure/App/Worker/React/Next/Prisma imports, and App direct Prisma/generated-client imports.

**US2 checkpoint**: `npm run architecture:check` passes the repository and demonstrates deterministic failure for every forbidden fixture.

### User Story 3 — Depend on one stable HTTP and error baseline

**Goal**: Ship versioned ping, uniform RFC 9457 errors/correlation/CORS, generated OpenAPI, and one same-origin typed client.

**Independent Test**: Ping and deliberate validation/error cases match the committed OpenAPI; canonical correlation propagates, malformed correlation is replaced/not echoed, disallowed origin is denied, and client uses a relative URL.

- [x] T024 [P] [US3] Write failing contract/integration tests for all five operations in `specs/001-solution-foundation/contracts/openapi.yaml`, RFC 9457 content/status/code/correlation, malformed/supplied correlation, no-store health, exact-origin CORS, and route-to-contract drift in `tests/contract/foundation/openapi.test.ts` and `tests/integration/api/foundation/ping-and-errors.test.ts`.
- [x] T025 [US3] Implement `PingResponse`, `GetPingQuery`, handler, and one-line route dispatch in `src/application/foundation/{queries,handlers,dto}/ping.ts` and `src/app/api/v1/ping/route.ts`; return service/version/status/current UTC and no database or provider data.
- [x] T026 [US3] Register Zod 4 schemas/operations, generate committed OpenAPI 3.1 JSON, and implement the shared relative-URL client in `src/app/lib/openapi-registry.ts`, `scripts/generate-openapi.ts`, `contracts/openapi/agentix-v1.json`, and `src/app/lib/api/client.ts`; semantic drift fails `openapi:check` and no hand-coded absolute/localhost browser URL is allowed.

**Phase gate**: Run all mandatory gates and all three independent checkpoints before Phase 4.

---

## Phase 4: User Story 4 — Persist and Dispatch Background Work (Priority: P2)

**Goal**: Atomically enqueue state/work, claim concurrently, retry with bounded delay, recover leases, enforce explicit scope, propagate cancellation, and produce exactly one demonstration effect under redelivery.

**Independent Test**: The HTTP demo creates request+work atomically, 100 concurrent claims produce one effect, forced rollback leaves neither row, crash/redelivery keeps one effect, transient failures stop at three attempts, expired leases recover, invalid scope/version never reaches a handler, and shutdown leaves no unrecoverable claim.

### Tests for User Story 4

- [x] T027 [P] [US4] Write failing real-PostgreSQL migration/constraint tests for all four tables, enum/check/index rules, UUID/timestamp mapping, immutable claimed envelope fields, 64 KiB Application payload rejection, and apply-twice behavior in `tests/integration/persistence/foundation-migration.test.ts` and `tests/integration/persistence/outbox-constraints.test.ts`.
- [x] T028 [P] [US4] Write failing atomic enqueue/idempotency/scope tests in `tests/integration/persistence/atomic-outbox.test.ts` and `tests/integration/worker/scope-validation.test.ts`; verify separate global/tenant factories, tenant requires `orgId`, global forbids it, duplicate `(type,scope,owner,key)` returns one work item, and rollback leaves no request/work.
- [x] T029 [P] [US4] Write failing 100-way `SKIP LOCKED` claim, crash/redelivery one-effect, and concurrent duplicate-key tests in `tests/integration/worker/concurrent-claim.test.ts` and `tests/integration/worker/idempotent-redelivery.test.ts`.
- [x] T030 [P] [US4] Write failing bounded backoff/max-attempt, permanent unknown-version/schema failure, expired-lease reaping, `AbortSignal`, SIGTERM/SIGINT, and ≤30 s graceful shutdown tests in `tests/integration/worker/retry-policy.test.ts`, `tests/integration/worker/lease-recovery.test.ts`, and `tests/integration/worker/graceful-shutdown.test.ts`.

### Implementation for User Story 4

- [x] T031 [US4] Implement validated `WorkEnvelope`/`WorkContext`, distinct `globalWork` and `tenantWork` factories, sensitive-key/64 KiB payload rejection, closed `WorkResult`, and duplicate/missing `(type,schemaVersion)` registry in `src/application/shared/work/{work-envelope.ts,work-context.ts,work-result.ts,work-handler-registry.ts}`.
- [x] T032 [US4] Implement atomic demo-request plus outbox enqueue, outbox/status repositories, and idempotency lookup in `src/infrastructure/persistence/{foundation-demo-repository.ts,outbox-writer.ts,outbox-query.ts}`; payload/type/scope/idempotency are immutable after first claim and errors persist stable codes only.
- [x] T033 [US4] Implement short-transaction batch claim and lease reaper using indexed Infrastructure-only `FOR UPDATE SKIP LOCKED`, attempt-row insertion, processing lease ownership, and `(available_at,created_at,id)` order in `src/infrastructure/work/{postgres-work-claimer.ts,postgres-lease-reaper.ts}`; process no handler while a claim transaction remains open.
- [x] T034 [US4] Implement worker coordinator/backoff/outcome persistence with poll 1000 ms, batch 10, lease 30 s, max attempts 3, base delay 1 s/cap 30 s plus jitter, W3C context propagation, cancellation, and recoverable shutdown in `src/infrastructure/work/{worker-coordinator.ts,retry-policy.ts,work-outcome-writer.ts}` and wire it into `src/worker/composition-root.ts`.
- [x] T035 [US4] Implement the idempotent `foundation.demo.requested` v1 handler transaction—unique request/work effect, request completion, outbox success, and attempt closure—in `src/worker/handlers/foundation-demo-handler.ts`; redelivery of an existing effect succeeds without incrementing effect count.
- [x] T036 [US4] Implement create/status Application DTOs/handlers and thin environment-gated routes in `src/application/foundation/{commands,queries,handlers,dto}/work.ts`, `src/app/api/v1/foundation/work/route.ts`, and `src/app/api/v1/foundation/work/[requestId]/route.ts`; first key returns 202, duplicate returns 200/same IDs, production-disabled returns ordinary 404, and responses never expose payload/SQL/stack/config.

**Phase gate**: All four mandatory gates plus the complete US4 independent test pass before Phase 5.

---

## Phase 5: User Story 5, Polish & Constitution Compliance (Priority: P2)

**Goal**: Finish safe diagnostics, canonical accessible design, performance/policy gates, CI parity, documentation, and evidence for all eleven constitutional principles.

**Independent Test**: One standard local/CI sequence is green; a reviewer correlates request→work in under 2 minutes; seeded sensitive markers occur zero times; the foundation page passes keyboard/focus/reduced-motion/200%-zoom/contrast checks; negative license/test/contract/architecture fixtures fail; no out-of-scope route/entity/dependency exists.

### Tests and implementation for User Story 5

- [x] T037 [P] [US5] Write failing end-to-end telemetry and zero-leakage tests with seeded markers in headers, nested payload, URL, environment, and thrown error in `tests/integration/observability/correlation.test.ts` and `tests/integration/security/diagnostic-redaction.test.ts`; inspect responses, health, Pino sink, spans, metrics, Problem Details, outbox error fields, OpenAPI, and snapshots for zero occurrences.
- [x] T038 [P] [US5] Write failing UI/browser accessibility tests for token values, loading/ready/error/retry, keyboard/focus, `aria-live`, text-plus-color state, no external font request, reduced motion, narrow viewport, 200% zoom, required contrast, and absence of future controls in `tests/unit/ui/foundation/design-tokens.test.tsx` and `tests/e2e/foundation.spec.ts`.
- [x] T039 [US5] Complete request/dispatch/DB/enqueue/claim/handler tracing and baseline bounded metrics in `src/infrastructure/observability/{telemetry.ts,metrics.ts,propagation.ts}`, `src/app/lib/route-dispatch.ts`, and `src/infrastructure/work/worker-coordinator.ts`; correlate logs by `correlation_id`/`work_id` while keeping IDs/payload/errors out of metric labels.
- [x] T040 [US5] Implement canonical design variables/components and all responsive/accessibility states in `src/app/globals.css`, `src/app/components/foundation/foundation-status.tsx`, and `src/app/page.tsx`; use the exact mock token names/values, variable-based component colors, visible focus, 4.5:1 body and 3:1 icon/large contrast, and complete `prefers-reduced-motion` overrides.
- [x] T041 [P] [US5] Add route/entity/dependency scope inventory and non-LLM endpoint performance tests (ping/readiness p95 <300 ms and readiness probe ≤2 s) in `tests/contract/foundation/scope-inventory.test.ts` and `tests/integration/performance/foundation-read.test.ts`; explicitly assert zero auth/tenant/project/secret/provider/run/metering/billing/webhook/simulator/approval surface and zero paid/external calls.
- [x] T042 [US5] Finalize fail-closed test policy, SPDX allow-only license scan (MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0; unknown/custom/unlicensed fail), semantic OpenAPI drift, architecture command, migration validation, and identical CI sequence in `scripts/{check-tests.mjs,check-licenses.mjs,check-openapi.mjs,check-architecture.mjs}`, `package.json`, and `.github/workflows/ci.yml`.
- [x] T043 [US5] Update clean-checkout/startup/worker/config/database documentation and exact reviewer commands in `README.md`, `.env.example`, and `specs/001-solution-foundation/quickstart.md`; include no real connection string or secret and document container worker deployment plus same-origin browser behavior.

### Constitution compliance and final verification

- [x] T044 [P] Create the PR compliance evidence checklist in `specs/001-solution-foundation/checklists/implementation.md`, with one verifiable line for Principles I–XI, dependency licenses/Complexity Tracking, additive migration/rollback, no approval route, no sensitive marker, design delta/accessibility, and quickstart reviewer sign-off.
- [x] T045 Run `npm run lint`, `npm test`, `npm run build`, and `npm run license:check`, execute all steps in `specs/001-solution-foundation/quickstart.md`, and record command/result/correlation evidence without secrets in `specs/001-solution-foundation/checklists/implementation.md`; stop and fix before checking this task if any warning/test/build/license/quickstart step is red.
- [x] T046 Reconcile implementation against every FR-001–FR-038 and SC-001–SC-012, confirm all prior task checkboxes/evidence and no scope drift, and document residual zero/missing items in `specs/001-solution-foundation/checklists/implementation.md`; anything outside spec becomes a new numbered spec rather than an extra implementation task.

**Final phase gate**: The four mandatory commands and reviewer quickstart are green with no suppressed warnings; implementation checklist confirms constitution compliance.

---

## Dependencies & Execution Order

### Phase dependencies

```text
Phase 1 Setup
    ↓
Phase 2 Blocking Foundation
    ↓
Phase 3 P1 slices (US1 + US2 + US3)
    ↓
Phase 4 Durable Work (US4)
    ↓
Phase 5 Quality + Compliance (US5)
```

- **Phase 1** has no dependency and creates only project/tooling structure.
- **Phase 2** depends on Phase 1 and blocks every story.
- **Phase 3** depends on Phase 2. US1, US2, and US3 tests can begin in parallel, but shared route composition is integrated before the phase gate.
- **Phase 4** depends on Phase 3 because its reviewable demonstration uses the established HTTP/error host; its persistence/worker tests remain directly runnable.
- **Phase 5** depends on Phases 3–4 because it verifies end-to-end telemetry, UI, policy, and full compliance.

### User story dependencies

- **US1 (P1)**: Starts after Phase 2; independently proves app/worker startup, page, and health.
- **US2 (P1)**: Starts after Phase 2; independently proves layer boundaries and can run in parallel with US1.
- **US3 (P1)**: Starts after Phase 2; uses shared Phase 2 route/error plumbing but not US1 business behavior; can run in parallel with US1/US2.
- **US4 (P2)**: Uses the Phase 2 persistence contracts and Phase 3 reviewable API host; no dependency on UI behavior.
- **US5 (P2)**: Integrates all completed surfaces to prove operational and quality guarantees.

### Within each story

1. Write named tests and verify failure for the intended missing behavior.
2. Implement Application contracts/behavior before Infrastructure adapters.
3. Implement adapters before route/worker composition.
4. Keep route bodies to typed parse plus one dispatch.
5. Run the story checkpoint, then the four phase gates.
6. Commit each completed implementation phase separately; do not mix artifact and code commits.

## Parallel Opportunities

- Phase 1: T003–T007 can proceed in parallel after T001/T002 establish package/layout.
- Phase 2: T008/T009 are parallel test streams; T012/T013 are parallel adapters after T010/T011; T014 can proceed beside shared Application work.
- Phase 3: US1 test/UI work (T017/T018), US2 tests (T022), and US3 tests (T024) are independent; implementation converges only at composition/gate.
- Phase 4: T027–T030 are parallel failing test suites before T031–T036; claim/retry and demo handler implementation can be split after shared work contracts exist.
- Phase 5: telemetry/redaction, UI/accessibility, performance/scope, and compliance checklist begin in parallel (T037, T038, T041, T044).

## Parallel Example: Phase 3 P1 Stories

```text
Task: "T017 [US1] health/startup integration tests"
Task: "T018 [US1] foundation status UI tests"
Task: "T022 [US2] architecture conformance tests"
Task: "T024 [US3] OpenAPI/ping/error contract tests"
```

## Parallel Example: User Story 4

```text
Task: "T027 [US4] migration and constraint tests"
Task: "T028 [US4] atomic enqueue/idempotency/scope tests"
Task: "T029 [US4] concurrent claim and redelivery tests"
Task: "T030 [US4] retry, lease, cancellation, and shutdown tests"
```

## Implementation Strategy

### MVP first

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 in this order when staffed by one agent: US1 → US2 → US3.
3. Stop after Phase 3 and validate each P1 checkpoint independently.
4. This is the minimum useful host for downstream feature work, but spec 001 is not complete until US4/US5 pass.

### Incremental delivery

1. **Setup + blocking foundation**: compiling boundaries and shared contracts.
2. **US1**: clean local app/worker startup and health/status page.
3. **US2**: mechanically enforced architecture.
4. **US3**: stable versioned HTTP/error/client contract.
5. **US4**: transactional outbox and resilient worker.
6. **US5**: telemetry, accessible canonical design, policy/CI, and compliance evidence.

### One-agent execution

Run `/speckit-implement` for exactly one numbered phase per session. Each phase has at most 10 tasks. Do not begin the next phase until lint, tests, build, and license scan are green and the phase has its own implementation commit.

## Notes

- `[P]` means different primary files and no incomplete-task dependency; coordinate shared config/package edits at phase integration.
- Story labels preserve traceability even where three P1 stories share one constitution-limited phase.
- Exact persisted constraints are centralized in T014 and verified by T027; later tasks must not weaken them.
- The foundation demo is non-business and environment-gated; never reuse it as a privileged shortcut for a later workflow.
- No implementation task may add authentication, organizations, projects, provider calls, secrets vault, runs, metering, billing, webhook ingress, simulator, or approval behavior.
