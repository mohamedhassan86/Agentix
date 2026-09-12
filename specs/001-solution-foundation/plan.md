# Implementation Plan: Solution Foundation

**Branch**: `001-solution-foundation` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-solution-foundation/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Create the compiling Agentix host that all later vertical slices extend: one strict TypeScript/Next.js application with enforced clean-architecture imports, a hand-written in-process command/query dispatcher, versioned REST contracts and RFC 9457 errors, PostgreSQL/Prisma migrations, a transactional outbox consumed by a cancellable Node worker, structured logs and OpenTelemetry correlation, canonical UI tokens and a temporary foundation status page, and identical local/CI quality gates. The foundation proves these mechanisms with ping, health, and explicitly non-business demonstration-work operations; it introduces no account, organization, project, provider, secret, run, metering, or approval behavior.

## Technical Context

**Language/Version**: Node.js 22 LTS; TypeScript 5.x with `strict: true`; ECMAScript modules

**Primary Dependencies**: Next.js 16.x, React 19.x, Zod 4.x, `@asteasolutions/zod-to-openapi` 8.x, Prisma Client/CLI 7.10.x, `@prisma/adapter-pg` + `pg`, Pino 10.x, OpenTelemetry JS API/SDK 2.x and Node auto-instrumentations, `uuid` 14.x; dev-only Vitest 5.x, Testing Library, Playwright, `@testcontainers/postgresql` 12.x, dependency-cruiser 18.x, and `license-checker-rseidelsohn` 5.x. All are MIT, Apache-2.0, BSD-3-Clause, or ISC; exact compatible patches are lockfile-pinned and scanned before implementation is accepted.

**Storage**: PostgreSQL 16+ through Prisma and the native `pg` adapter; additive migration `001_solution_foundation`; JSONB only for redacted/versioned work payloads; no Redis or external broker

**Testing**: Vitest for unit/integration/UI tests, Testing Library with jsdom, PostgreSQL 16 Testcontainers for persistence/concurrency/migration tests, Playwright for page/accessibility smoke, generated OpenAPI conformance, dependency-cruiser boundary checks, and allow-list license scanning

**Target Platform**: Next.js Node runtime on Vercel or equivalent Node host; separate long-running Node worker container/process; modern browsers supported by Next.js 16; same-origin browser API calls

**Project Type**: Full-stack web application plus worker in one npm project and one TypeScript codebase

**Performance Goals**: Non-LLM ping/readiness p95 < 300 ms; readiness DB probe bounded to 2 s; worker notices available work within 2 s under default local settings; graceful shutdown completes within 30 s or safely releases the lease; 100 concurrent claims produce one effect

**Constraints**: No business entities; no paid/external provider calls; no customer secrets; route body is typed parse plus one dispatch; Application and Domain have no framework/ORM imports; outbox is at-least-once and idempotent; tenant-scoped jobs require explicit `orgId`; no logs/traces/errors with secret markers; all browser calls same-origin; standard lint/test/build/license gates have no suppressed warnings

**Scale/Scope**: 1 web host, 1 horizontally safe worker host, 5 public foundation HTTP operations, 4 foundation persistence tables, 1 demonstration work type, 1 OpenAPI document, 1 temporary status/pattern page, and architecture/contract/license/telemetry test harnesses reused by all later specs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-research gate

| Principle / constraint | Status | Plan evidence |
| --- | --- | --- |
| I. Spec-driven delivery | ✅ PASS | Spec 001 exists and this command creates only Phase 0/1 artifacts. `/speckit-clarify` is skipped because the constitution and spec settle all choices and this slice has no business state machine, money rule, or authorization boundary. |
| II. Clean architecture | ✅ PASS | Fixed `src/{domain,application,infrastructure,app,worker}` layout; dependency-cruiser and TypeScript project references enforce inward dependencies. Domain remains an empty/pure extension point; Application declares ports and use cases. |
| III. Rich domain model | ✅ PASS | No business aggregate is invented. Work/outbox lifecycle is infrastructure state with closed transitions documented in [data-model.md](./data-model.md), not a generic business entity. |
| IV. Thin route handlers | ✅ PASS | Health, ping, and demonstration-work handlers perform one typed parse when needed and one dispatch. Correlation, errors, logging, CORS, and telemetry are shared wrappers/middleware. |
| V. Tenant isolation | ✅ PASS (foundation) | Outbox scope is closed as `global` or `tenant`; database checks require `org_id` for tenant work; worker context is explicit and fail-closed. Tenant repositories/filters wait for 002. |
| VI. Secrets ciphertext | ✅ PASS (boundary) | No credential storage. Typed server config, Pino redaction, safe errors, telemetry attribute allow-lists, and seeded-marker tests prevent leakage. |
| VII. Verified ingress only approval | ✅ PASS | No webhook, approval route/state, or simulator shortcut exists; a route inventory test asserts the absent approval surface. |
| VIII. Source provider neutrality | ✅ N/A | No `ISourceProvider` or host SDK is introduced. |
| IX. Hooks/metering | ✅ PASS (foundation only) | PostgreSQL outbox and worker are generic plumbing. There are no hooks, agent messages, LLM calls, ledger rows, or budgets. |
| X. Test-gated DoD | ✅ PASS | Vitest/Testcontainers/Testing Library/Playwright, coverage thresholds, architecture and contract checks, migration tests, license allow-list, and identical CI scripts are planned. |
| XI. Design fidelity | ✅ PASS with Design Delta | Canonical tokens and components are copied into app styles. The temporary foundation page is not a new product IA and is explicitly recorded below. Accessibility states are mandatory. |
| Runtime/data/API globals | ✅ PASS | Node 22, strict TypeScript, Next 16/React 19, PostgreSQL 16/Prisma, UUID v7, snake_case, UTC `timestamptz`, REST JSON `/api/v1`, OpenAPI 3.1, RFC 9457, correlation headers. |
| Dependency licenses | ✅ PASS | Every direct dependency has a constitution-permitted SPDX license; transitive packages are checked by the committed allow-list command. |

No constitution exception is requested.

### Post-design re-check

- [research.md](./research.md) resolves every dependency, worker, migration, API, observability, architecture, and deployment choice; no `NEEDS CLARIFICATION` remains.
- [data-model.md](./data-model.md) keeps tenant scope explicit, uses lease recovery and unique idempotency constraints, and contains no customer business entity.
- [contracts/openapi.yaml](./contracts/openapi.yaml) exposes only health, ping, and foundation demonstration operations; all errors use the shared Problem schema and no approval/auth/provider surface exists.
- [contracts/events.md](./contracts/events.md) versions the internal outbox envelope and demonstration payload, forbids sensitive payload fields, and specifies at-least-once/idempotent behavior.
- [quickstart.md](./quickstart.md) exercises clean setup, migration, health, one-effect concurrency, cancellation/recovery, correlation, redaction, accessibility, and all mandatory gates.
- Raw SQL is confined to Infrastructure for the PostgreSQL `FOR UPDATE SKIP LOCKED` claim operation and migration checks; Application/App cannot import it. This is permitted and not a tenant-filter bypass because no tenant table exists and scope checks remain mandatory.

### UI: Design Delta

The canonical `Public/Desgin/index.html` does not include a pre-authentication engineering status page. Spec 001 temporarily uses `/` for a compact **Agentix Foundation** page so reviewers can validate the host before identity UI exists.

| Delta | Reason | Boundaries |
| --- | --- | --- |
| Product name is Agentix instead of mock “SpecOps” | Repository/product name and downstream 002 assumption | Text only; mock typography and component language remain. |
| Root page shows host/readiness and pattern cards rather than the full marketing/auth screen | Accounts and organizations belong to 002; fake auth would violate scope | Temporary page is replaced by 002. It has no product navigation, sign-in, or simulated future controls. |
| Status page adds loading, ready, dependency-error, and retry states | Required by FR-032 and Principle XI | Uses `.card`, `.card-header`, `.status-chip`, `.banner`, `.field`, and `.btn`; no new visual system. |
| Inter is loaded without making an external font request at runtime | Foundation must run offline/keyless | Use a packaged/local font asset or system fallback with matching metrics; no Google Fonts network dependency. |

CSS custom properties copy the canonical names/values (`--bg`, `--surface*`, `--border*`, `--text`, `--muted*`, `--primary*`, `--cyan*`, `--green*`, `--yellow*`, `--red*`, `--radius`, `--sidebar-width`). Component rules consume tokens instead of literal component hex values. The page has semantic headings, labelled retry, text-plus-color status, `aria-live="polite"`, visible focus, 200% zoom support, 4.5:1 body/3:1 icon contrast, responsive layout, and complete reduced-motion overrides.

## Project Structure

### Documentation (this feature)

```text
specs/001-solution-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml
│   └── events.md
├── checklists/
│   └── requirements.md
└── tasks.md              # Created by /speckit-tasks, not this command
```

### Source Code (repository root)

```text
.github/
└── workflows/
    └── ci.yml

contracts/
└── openapi/
    └── agentix-v1.json

prisma/
├── schema.prisma
└── migrations/
    └── *_001_solution_foundation/
        └── migration.sql

scripts/
├── check-licenses.mjs
├── check-tests.mjs
└── generate-openapi.ts

src/
├── domain/
│   └── index.ts
├── application/
│   ├── foundation/
│   │   ├── commands/
│   │   ├── queries/
│   │   ├── handlers/
│   │   └── dto/
│   └── shared/
│       ├── dispatch/
│       ├── errors/
│       └── ports/
├── infrastructure/
│   ├── config/
│   ├── observability/
│   ├── persistence/
│   └── work/
├── app/
│   ├── api/v1/foundation/work/
│   ├── api/v1/ping/
│   ├── health/live/
│   ├── health/ready/
│   ├── components/foundation/
│   ├── lib/api/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
└── worker/
    ├── handlers/
    ├── composition-root.ts
    └── main.ts

tests/
├── architecture/
├── contract/foundation/
├── integration/
│   ├── api/foundation/
│   ├── persistence/
│   └── worker/
├── unit/
│   ├── application/
│   ├── infrastructure/
│   └── ui/
└── e2e/
    └── foundation.spec.ts
```

**Structure Decision**: Use one npm/Next.js project because the constitution requires one codebase and separate layer roots, not a workspace per layer. TypeScript aliases and dependency-cruiser enforce the roots. The app and worker are separate composition roots sharing Application/Infrastructure modules. A generated root OpenAPI JSON is the machine-checkable artifact; the spec-local YAML is the reviewed design contract. No `src/domain/foundation` model is created merely to populate a folder.

## Complexity Tracking

No constitutional violation is accepted. Architecture-relevant choices are justified here as required by the dependency policy.

| Mechanism / dependency | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| `dependency-cruiser` architecture gate | TypeScript path aliases do not prevent reverse imports; explicit forbidden-edge fixtures make Principle II mechanically testable and identify source/target. | ESLint path restrictions alone become brittle as folders grow and do not provide a full dependency graph/cycle rule. |
| PostgreSQL transactional outbox with polling, leases, `FOR UPDATE SKIP LOCKED`, and attempt rows | Later slices need atomic state+work, concurrent claims, crash recovery, bounded attempts, and no new service. | In-memory queues lose work; synchronous side effects dual-write; Redis/external brokers add infrastructure and still do not solve database atomicity. |
| OpenTelemetry Node SDK plus Pino | Constitution requires vendor-neutral traces/metrics and structured logs shared by app/worker. | Console logging and custom timing counters cannot propagate standard context or support production exporters consistently. |
| Zod schemas plus `@asteasolutions/zod-to-openapi` | One runtime-validation source generates OpenAPI and typed client inputs, preventing the server/client/contract drift required by FR-016/017. | Hand-maintained YAML/types duplicate schema definitions; adding an API framework would conflict with thin Next.js route handlers. |
| Prisma plus native `pg` adapter | Constitution fixes typed ORM/PostgreSQL; direct adapter works in Node app/worker and permits Infrastructure-only claim SQL where ORM query APIs cannot express queue locking safely. | ORM-only queue claiming cannot reliably express `SKIP LOCKED`; raw SQL throughout the app violates layer rules. |
