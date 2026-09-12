# Agentix Constitution

Agentix is a multi-tenant SaaS that runs a Spec Kit SDLC pipeline with one agent per phase
(specify → clarify → plan → tasks → implement), drives every human interaction through a Git
host, and meters every LLM call down to the cent. This constitution is the binding set of
rules that keep those four systems — tenancy, secrets, agent orchestration, and money —
from drifting apart.

## Core Principles

### I. Spec-Driven Delivery Is the Only Path (NON-NEGOTIABLE)

Every change to production code, schema, or UI starts from a numbered feature directory at
`specs/NNN-feature/` produced by the Spec Kit workflow. No spec → no plan → no code.

- The mandatory phase order is `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-implement`. The enhancement commands are **OPTIONAL** — `/speckit-clarify`,
  `/speckit-analyze`, `/speckit-checklist` — and are run when a spec carries a state machine, a money
  rule, an authorization boundary, or UI that departs from the design guideline. Skipping one is a
  legitimate decision: record the skip in `plan.md` in one line with its reason, don't omit it
  silently, and don't treat an optional step as a gate.
- The constitution governs *how* the product is engineered; it does not restate *what* the product
  promises its users. Screen flows, command syntax, role matrices, trigger labels and
  customer-chosen thresholds are functional requirements living in `specs/NNN/spec.md`. An amendment
  MUST remove governance text that has drifted into product description.
- Before specifying, the agent MUST re-read `.specify/memory/constitution.md` (this file) and the
  `spec.md`, `plan.md`, `data-model.md`, and `contracts/` of every already-delivered feature, then
  record in the new spec's **Constitution Check** which prior constraints bind it. Skipping this
  re-read is the primary cause of regressions across specs.
- Each phase MUST commit its artifacts using the real Spec Kit templates, unchanged in structure:
  `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/*.md`,
  `tasks.md`. Templates are resolved through `.specify/scripts/bash/resolve-template.sh`, never
  hand-forked into a new format.
- Implementation executes in phases of at most 10 tasks. A phase is complete only when build and
  tests are green (Principle X); the next phase MUST NOT start on a red tree.
- One spec per vertical slice, sized so the whole pipeline fits in ≤ 5 task phases. Cross-cutting
  rewrites are their own spec.
- **Mock-first ordering**: the orchestration engine (phases, hooks, Judge, metering, timeline,
  budgets) is built and proven against the Mock LLM provider and the Simulated repository before
  any real GitHub integration or paid provider call exists. Real integrations are additive specs,
  never prerequisites.
- Specs describe *what* and *why*; they MUST NOT contain implementation detail (library names,
  table columns, class shapes). That belongs in `plan.md`.

Rationale: the product's own value proposition is spec-driven delivery; a repo that violates it
cannot credibly sell it, and per-phase artifact commits are what make agent output reviewable.

### II. Clean Architecture and the Dependency Rule

Solution layout is fixed; dependency direction points inward and is never violated.

```
src/Agentix.Domain          → entities, value objects, domain events, domain services, errors
src/Agentix.Application     → use cases (commands/queries + handlers), ports, DTOs, policies
src/Agentix.Infrastructure  → EF Core, Postgres, LLM providers, ISourceProvider (GitHub/AzureDevOps),
                              crypto, queue/Hangfire, telemetry adapters
src/Agentix.Api             → controllers, middleware, filters, OpenAPI, composition root (part)
src/Agentix.Worker          → hook/agent execution host, composition root (part)
tests/Agentix.Domain.Tests, tests/Agentix.Application.Tests, tests/Agentix.IntegrationTests
client/agentix-web          → Angular workspace (app + shared design-token library)
```

- `Agentix.Domain` MUST NOT reference EF Core, ASP.NET, HttpClient, provider SDKs, Hangfire,
  serialization attributes, or any UI type. It has zero NuGet dependencies.
- `Agentix.Application` references only `Agentix.Domain`. Ports (interfaces) are declared here;
  implementations live in `Agentix.Infrastructure`.
- Only the composition roots (`Api`, `Worker`) reference all layers and register DI.
- No layer skips: `Api` MUST NOT touch `DbContext` or aggregates directly, and `Application`
  MUST NOT issue raw SQL.
- Every aggregate and use case MUST be constructible in a unit test without a DI container, a
  database, or the network.

Rationale: the pipeline must stay testable while providers, hosts, and ORM details churn.

### III. Rich Domain Model; Invariants Live in Aggregates

- Aggregates expose behaviour named in business language (`Run.StartPhase`,
  `Project.ApplySpend`, `Organisation.GrantRole`, `ProviderKey.Rotate`), never public setters and
  never `Update(entity)`-style generic persistence of mutated state.
- An entity or value object with only data is a review defect. Constructors of aggregate roots are
  private/factory-guarded so creation invariants cannot be bypassed.
- All invariants are enforced inside the aggregate; a handler that "checks then mutates" across two
  aggregates signals a wrong aggregate boundary, not a clever optimization.
- State transitions are explicit and closed: run status, PR/draft state, hook-run status, secret
  status, invitation status. Illegal transitions throw a `DomainRuleException` carrying a stable
  error code (mapped to 409/422 by middleware) — never a silent no-op.
- Cross-aggregate effects are published as domain events recorded in the outbox in the same
  transaction, then delivered by the worker; no dual-write from a handler to a queue.
- Value objects for `Money` (decimal), `TokenUsage`, `JudgeScore` (four dimensions + mean),
  `SemVerRef`, `WebhookSignature`, `EncryptedBlob`. Money and token arithmetic never floats.
- Inter-agent traffic is a typed event (`HookRunStarted`, `JudgeVerdictRecorded`,
  `FeedbackLoopAttempted`, `ApprovalRequested`) — the same event types feed the run timeline.

Rationale: budgets, approval state, and tenant rights are invariants; if they live in handlers they
will be duplicated by the next handler and the one after that.

### IV. Thin Controllers; Explicit Commands and Queries

- A controller action body is exactly one dispatch line plus, when required, an attribute set.
  No branches, no repository/DbContext access, no try/catch, no manual error mapping, no business
  logging inside actions.

  ```csharp
  [HttpPost("{projectId}/runs")]
  public Task<RunStartedDto> Start(Guid projectId, StartRunCommand command, CancellationToken ct)
      => _dispatcher.Send(new StartRunCommand(projectId, command.PhaseSelectionId), ct);
  ```

- Cross-cutting behaviour belongs in middleware/filters: authentication, tenant binding,
  rate limiting, model validation, `ProblemDetails` mapping, metering correlation, request logging.
- Command handlers mutate through aggregates; query handlers read through projections
  (`IQueryable` → DTO) and MUST NOT mutate state or return EF entity types across the boundary.
- Contracts are code-first with explicit request/response records in `Agentix.Application`;
  OpenAPI 3.1 is generated from them and committed to `contracts/openapi/*.json` per spec so the
  Angular client can generate typed clients from the same source of truth.
- Endpoints are versioned under `/api/v1`; breaking changes require a new version and a spec.
- Library policy: only permissively licensed open source (MIT, Apache-2.0, BSD-2/3, ISC, MPL-2.0).
  A dependency with a commercial or copyleft obligation MUST NOT be introduced. CQRS dispatch may
  use such a free library or a hand-written `ICommandDispatcher`; either way one handler per request
  and no hidden pipeline magic.

Rationale: thin actions keep authorization, metering, and error shape uniform, and keep the API
surface mechanically testable (Principle X).

### V. Tenant Isolation by Construction

- Strategy: single shared schema, `org_id uuid NOT NULL` on every tenant-scoped table. No
  schema-per-tenant and no database-per-tenant unless this constitution is amended (MAJOR).
- EF Core global query filters are applied to every tenant-scoped entity type by convention
  (registry-driven, so a new entity cannot silently opt out) and child/owned collections are
  filtered through their owning root.
- `ITenantContext` is established by middleware *before* any handler runs; a request that names a
  tenant-scoped resource without a resolvable, authorized tenant fails closed with 403 — it never
  falls back to "no filter".
- Reads are filtered; writes MUST additionally verify ownership of every supplied identifier
  (fetch-under-filter, not `IgnoreQueryFilters`). `IgnoreQueryFilters()` is banned in
  `Application` and `Api`; permitted only in system/worker maintenance paths with a justification
  comment, an owner-approved exception, and a covering test.
- Client payloads and query strings MUST NOT carry an organization identifier when the token or
  webhook connection already implies it. Membership (role) checks are authorization policy, not
  controller code.
- Background work (hooks, agent runs, budget sweeps) receives the tenant id explicitly in the job
  payload; ambient tenant state MUST NOT be relied on across queue boundaries.
- Every API surface ships a cross-tenant test: same endpoint, second tenant's identifier → 403/404
  and zero data leakage in the response body or logs.
- A tenant-isolation defect is Severity 1: it stops the line, gets a post-incident note, and a
  regression test before the spec may be marked done.

Rationale: multi-tenancy is a security property, not a filter feature; convention + fail-closed +
per-endpoint tests are the only enforcement that survives new tables.

### VI. Secrets Are Ciphertext Everywhere (NON-NEGOTIABLE)

Scope: LLM provider API keys, GitHub tokens, Azure DevOps PATs, webhook signing secrets, and any
future credential.

- Envelope encryption: AES-256-GCM with a per-organization data encryption key (DEK, 256-bit,
  random) wrapped by a master key encryption key (KEK) held in a KMS/secret manager (AWS
  KMS/Secrets Manager, Azure Key Vault, or GCP KMS) behind the `ISecretProtector` port. The KEK
  never exists in the database, an image, a repo, or a config file.
- Persisted per secret: ciphertext, 12-byte nonce, 16-byte auth tag, KMS key id + wrapping
  metadata, algorithm/version id, `created_at`, `rotated_at`, `revoked_at`. Additional
  authenticated data binds `(org_id, secret_kind, row_id, version)` so a ciphertext cannot be
  transplanted between rows or tenants.
- Random nonce per encryption; never reused, never derived from content.
- Plaintext exists only transiently in memory for a provider call. It MUST NOT be logged, returned
  by any API or OpenAPI schema, echoed in error details, written to the run timeline, embedded in
  a URL/webhook path, or committed. API responses expose metadata plus a masked hint (last 4
  characters max).
- Zero-redaction verification: integration tests assert that no plaintext secret appears in the log
  sink, response body, OpenAPI document, or timeline events for the secret endpoints and the
  provider-call path.
- Secret access is audited: who (user or run id), which secret version, for what purpose
  (`llm-call`, `webhook-verify`, `repo-access`), and when — visible in the Secret access log screen.
- Rotation appends a new version and marks the previous one decrypt-only; revocation makes the
  secret unusable within one worker tick (≤ 60 s) and is an audited event.
- Key material used to verify inbound events (webhook signing secrets) is governed by this
  principle too: high-entropy generation, encrypted storage, rotation, and constant-time comparison
  at the boundary. It MUST NOT appear in a URL query string, a log line, or an error body, and MUST
  NOT leak which part of verification failed. The protocol itself — header names, signature algorithm
  choice, replay window, de-duplication, rejection status codes — is specified in `specs/009-*`.
- Removing a member or downgrading a role revokes their effective access immediately; deleting an
  organization destroys its DEK (crypto-shredding) and leaves a tombstone row only.

Rationale: the product stores the keys that can spend the customer's money and read their source
code; the blast radius of a database leak must be zero.

### VII. One Verified Ingress Is the Only Approval Path

What a run's approval *means* to a user is product behaviour. What is governed here is the
architecture that keeps that meaning safe as the product grows.

- Approval state advances **only** through the verified inbound event path of the active
  `ISourceProvider`. The API MUST NOT expose any endpoint that moves a run's approval state — no
  console button, no admin override, no "quick approve" for demos. Asserting the absence of such a
  route is part of Principle X's per-surface integration coverage.
- Real and simulated events share one code path: the dashboard simulator submits through the same
  verified ingress and the same handler. A privileged simulator shortcut (direct service call,
  seeded database state, test-only route) is a defect, because it lets demo behaviour diverge from
  production behaviour.
- Verification, replay rejection and de-duplication happen at the boundary, before any handler runs,
  so handlers assume a verified event delivered once. Ordering is reconciled by the run state machine
  and never inferred from arrival order; a failed phase of processing is retryable and observable,
  never lossy.
- Outbound side effects are queued as idempotent jobs keyed by the inbound event that requested them,
  so an inbound retry cannot double-write to the repository.
- Trigger labels, command syntax and reply copy, per-command role requirements, merge-means-delivery
  semantics, and the concrete values of windows and de-duplication keys are **not** governance. They
  belong to `specs/009-*` and `specs/010-*`, and are captured for those specs in
  [`docs/business-rules/github-approval-surface.md`](../../docs/business-rules/github-approval-surface.md).

Rationale: keeping approval inside the source host preserves the audit trail, review history and CI
gates that a bespoke approval button would bypass. Only "no other path may exist" needs to be
governance — that is precisely what a later convenience feature would otherwise reintroduce.

### VIII. Provider Neutrality via `ISourceProvider`

- `ISourceProvider` (Application port) covers: create branch, commit files, open/update draft PR,
  read PR state, create/list comments, read reactions/labels, verify inbound event, list commits,
  read tree/blob, search, and (for review) request changes.
- Providers declare capabilities up front (`SupportsDraftPR`, `SupportsCommitOnBranch`,
  `SupportsInboundWebhook`, `SupportsThreadedReview`, `SupportsChecks`) via a `GetCapabilities()`
  result. Consumers check capabilities; unsupported operations return a typed
  `CapabilityNotSupportedException` mapped to `501 Not Implemented` with the missing capability in
  the payload — never a `NotImplementedException` surfacing mid-job.
- Azure DevOps ships as a typed, compiling stub behind the same contract (documented
  "capability matrix" in its spec). GitHub is the first complete implementation.
- Provider SDK types NEVER appear in `Domain` or `Application`; all mapping happens in
  `Infrastructure`, in provider-specific adapter classes.
- All outbound provider calls run through a typed client with timeouts, bounded retries with
  exponential backoff + jitter on transient failures, circuit breaker per connection, respect for
  `Retry-After`/rate-limit headers, and per-connection concurrency limits.
- Every inbound payload (redacted) and outbound write is persisted as a source event so the
  simulator can replay it and so a re-run is reproducible.

Rationale: the agent bus, the approval model, and metering must be independent of which Git host an
organization uses.

### IX. Hooks Are the Agent Bus; Every Call Is Metered

- Hooks are the only inter-agent transport. `before` hooks gather read-only repository context —
  tree, README, constitution, existing specs, search, commit history — and MUST NOT mutate the
  repository or database beyond their own `hook_run` record.
- `after` hooks evaluate and react: the Judge scores a phase artifact on **Completeness,
  Correctness, Specificity, Measurability** and stores each dimension plus the arithmetic mean as
  `JudgeScore`.
- The Judge feedback loop is bounded: an attempt ceiling and a pass threshold, both configurable per
  project within a range fixed by the owning spec (see *Ratified Defaults*). An unbounded loop is a
  defect, as is a loop that can pass a phase without a recorded score. Each attempt, score and
  rejection reason is recorded; an exhausted loop ends with a `JudgeExhausted` timeline event and a
  review request on the source host — never a silent pass.
- Per-phase agent selection (provider, model, temperature, rules, skills from the skill library —
  built-in Spec Kit skills plus org-authored skills) is resolved through an immutable
  `AgentProfileSnapshot` copied onto the run, so a later config edit cannot change history or
  billing.
- Every hook run, tool call, agent message, judge verdict, and provider error is a timeline event
  with `(org_id, project_id, run_id, phase, agent, seq, kind, payload, created_at)`, ordered by
  `seq`.
- Metering is mandatory and first-class: one `LlmCallRecord` per LLM call — provider, model,
  input/output/cached tokens, latency ms, status, error, unit-price version, and the attribution
  chain org → project → run → phase → agent → skill. Cost is computed from the pricing table
  (system defaults + per-org overrides) at the time of the call, and the price version is stored so
  historical figures never change.
- Budgets at organization and project level are **hard stops**, enforced in the dispatch path before
  a provider call (estimated cost of the planned call vs. remaining budget) and reconciled after
  (actual spend accumulated). On breach the run transitions to `BudgetBlocked`, emits a timeline
  event, exposes the spend breakdown on the run's cost view, and stops scheduling further phases.
  Nothing is truncated or billed silently; the warning threshold and stop policy values are specified
  by the metering spec, not here.
- The Mock provider is deterministic: fixed token counts, latency, and cost per model alias, so
  budget, ledger, and dashboard maths are assertable in tests without network or spend.
- Dashboards (by phase, model, role, day, project) read only from the metering ledger — one
  accounting path, no parallel aggregations.

Rationale: cost control, reviewability, and the Judge loop are the product's economic core; if any
one of them can be bypassed, the whole budget story is fiction.

### X. Test-Gated Definition of Done (NON-NEGOTIABLE)

- xUnit for all backend tests.
- Unit tests (Domain/Application, no DB, no network): every invariant, state transition, value
  object, Judge score calculation, budget decision, and pricing computation — including the failure
  paths and the exact error codes.
- Integration tests for each API surface, using `WebApplicationFactory` against a real Postgres
  (Testcontainers, or a Neon/Supabase branch DB): status codes, validation, `ProblemDetails`
  shape, authorization per role, **cross-tenant isolation per endpoint**, secret redaction,
  idempotent replay, and OpenAPI-contract conformance.
- Webhook tests with fixed HMAC fixtures: valid signature, tampered body, wrong secret, expired
  timestamp, replayed delivery, unknown connection.
- Angular: unit tests (Vitest or Jest) for state, permission-driven rendering, and cost formatting;
  an E2E smoke (Playwright) over the golden path — register → org → project + repo mapping → agents
  per phase → mock run → timeline → `/approve` via simulator → merge → delivered.
- A phase is complete only when all of the following pass locally and in CI with no suppressed
  warnings: `dotnet build`, `dotnet test`, analyzer/`dotnet format --verify-no-changes`,
  license scan, `ng lint`, `ng test --watch=false`, `ng build`.
- EF migrations: additive and reversible by default; any destructive change needs a
  "Data Migration" section in `plan.md` with a rollback plan; migration names include the spec
  number.
- Coverage floors: ≥ 90 % lines on rule-bearing Domain code, ≥ 80 % on Application handlers.
  Floors are guides, not goals — the security-relevant rules in Principles V and VI need named
  tests, not percentage.
- No `[Fact(Skip = ...)]` without a linked issue; no stubbed assertion (`Assert.True(true)`); no
  test that passes for the wrong reason (each negative test names the code it expects).
- "Done" for a spec = merged PR + `quickstart.md` steps verified against the running stack +
  constitution compliance confirmed.

Rationale: the app is an orchestrator of money and access; the only affordable safety net is
automated, tenant-aware, integration-grade tests.

### XI. Design-Guideline Fidelity

`Public/Desgin/index.html` is the canonical UI specification (the misspelled path is the agreed
location; do not rename it) for information architecture, layout, tokens, and component style.

- Information architecture is preserved: sidebar nav groups **Workspace** (Dashboard, Projects,
  Runs, Members), **Platform** (Connections, Agents, Simulator), **Manage** (Usage, Billing,
  Settings); project sub-navigation Overview / Runs / Usage / Agents / Connections; the auth
  screen and the org switcher exist as drawn.
- Design tokens are implemented as CSS custom properties on `:root` with the same names and values
  (`--bg #080b11`, `--surface`, `--surface-2`, `--surface-3`, `--border`, `--text`, `--muted`,
  `--primary #8274f8`, `--cyan`, `--green`, `--yellow`, `--red` + their `-soft` variants,
  `--radius 14px`, `--sidebar-width 258px`). Components use tokens; literal hex values in component
  styles fail review.
- Type and iconography: Inter at 14 px base with 1.5 line-height, monospace stack for code,
  diff/log, and command input; Lucide icons at the drawn sizes (16 px nav, 14 px controls,
  11–13 px in-chip).
- Component inventory is honored — `.card` + `.card-header`, `.stats-grid` (4-up KPI cards),
  `.status-chip` with dot, `.banner` variants (cyan/yellow/green/red), `.field` + `.input-mini`,
  `.segmented`/`.seg-btn`, `.chip` filters, `.table-wrap` for ledger/billing tables, `.toast-stack`
  for async feedback, `.modal` for create/invite/add-key flows, `.security-note` for the
  encryption callouts, and the phase-track (`simTrack`) with `done`/`current` states.
- Every screen ships the states the mock implies but does not draw: loading, empty, error,
  permission-denied (role-gated controls disabled with a reason, not hidden silently),
  budget-blocked, and awaiting-review.
- Accessibility obligations the mock does not cover — these are MANDATORY for the implementation:
  visible `:focus-visible` ring for every interactive element; full keyboard operation of modals,
  drawers, tabs, and the org switcher with focus trap and `Esc` close; `aria-*` roles/labels for
  tabs, menus, dialogs, live regions (`aria-live="polite"` for the run timeline and simulator log);
  labelled form controls with inline error text; colour never the sole signal for status (each
  chip carries text); `prefers-reduced-motion: reduce` disables all transitions/animations;
  contrast ≥ 4.5:1 for body text and ≥ 3:1 for icons and large text.
- Copy that encodes invariants is reproduced verbatim, including
  "There is intentionally no approve button."
- Any visual/behavioural deviation from the mock requires a **Design Delta** note in `plan.md`
  §UI: what changed, why, and what principle it serves. Inventing a new visual language is out of
  scope for feature specs.

Rationale: the mock is the product brief; unifying tokens, components, and states in code is what
lets eleven screens stay consistent while the backend grows.

## Global Constraints

- **Runtime**: .NET 10 (LTS) with `net10.0`, nullable reference types enabled, warnings-as-errors,
  implicit usings, analyzers on. Angular 22+ with standalone components, signals for local state,
  and TypeScript `strict: true`.
- **Data**: PostgreSQL 16+ (Neon, Supabase, or RDS) via EF Core 10 + Npgsql. Snake_case tables
  (plural) and columns; `uuid` primary keys (v7/sequential to avoid index hot spots); composite
  indexes leading with `org_id`; `timestamptz` in UTC; `numeric(18,6)` for money, `numeric(18,10)`
  for per-unit prices, `bigint` for token counts; `jsonb` for hook/agent payloads (already redacted);
  soft delete only where audit requires history.
- **API**: REST + JSON, OpenAPI 3.1 generated from code, `/api/v1`, cursor pagination (default 25,
  max 100), `ProblemDetails` (RFC 9457) for all errors with a stable `code`, correlation id in
  every response header. No GraphQL.
- **AuthN**: ASP.NET Core Identity (or an equivalent free OSS stack) with short-lived JWT access
  tokens and rotating refresh tokens in `HttpOnly`/`Secure`/`SameSite=Lax` cookies; MFA enforced at
  org level where the provider supports it; no auth logic in controllers (policies only).
- **Background work**: Hangfire or a durable `IHostedService` queue over the Postgres outbox — chosen
  once in `001` and reused. Job bodies MUST be idempotent, tenant-explicit, and cancellable via
  `CancellationToken` propagated from the trigger.
- **Observability**: structured JSON logging (Serilog or `Microsoft.Extensions.Logging` +
  `AddJsonConsole`) with `org_id`, `project_id`, `run_id`, `phase`, `agent`, `correlation_id` on
  every record; OpenTelemetry traces + metrics for HTTP, EF, hook execution, and every LLM/provider
  call (span attributes: provider, model, tokens, cost, judge score, status). Metrics include
  `llm_call_duration_seconds`, `llm_cost_per_phase`, `hook_failures_total`, `budget_blocks_total`,
  `webhook_rejected_total`. Secret values, tokens, and full prompts/responses MUST NOT be logged;
  prompt/response bodies are opt-in, size-capped, and redaction-scanned. Retention default 30 days
  for traces, 13 months for ledger rows.
- **Hosting split**: Angular builds deploy to Vercel as a static SPA (no server-side secrets, no
  private keys in `NEXT/VITE/NG` env; only public config like API base URL). The .NET API and
  workers run on a real host — locally via Visual Studio dev tunnel / reverse proxy, deployed to a
  container or app service with TLS 1.2+ and an explicit CORS allow-list. Vercel proxies
  `/api/*` to the .NET host so the browser only ever talks same-origin. Postgres stays on the
  managed provider. Nothing server-side runs on Vercel.
- **Licensing**: permissive OSS only (MIT/Apache-2.0/BSD/ISC/MPL-2.0); a license scan gate in CI.
- **Config**: `appsettings.json` + `appsettings.{Dev,Staging,Prod}.json` with no secrets; env vars
  or KMS-provided values at runtime; `.env`, user-secrets, and connection strings never committed;
  one `IOptions`-typed config class per subsystem, validated on start (`ValidateOnBuild`), fail
  fast on missing required settings.
- **Performance budget**: non-LLM read endpoints p95 < 300 ms at 10 k rows/tenant; webhook ingress
  acknowledges within 5 s by enqueueing work rather than doing it inline; agent phases run off the
  request path.

## Delivery Workflow and Quality Gates

- **Branch per spec, first**: a spec branch named `NNN-short-name` MUST exist before any spec
  artifact is written. This is enforced by the mandatory `before_specify` hook
  (`/speckit-git-feature`, `optional: false`). Specs, code, migrations, tests, and docs for a
  feature all live on that branch; delivery is a PR back to `main`. In hosted agent sessions that
  are pinned to a session branch, create the spec branch locally, commit there, and push both the
  spec branch and the session branch so review and session tracking both work.
- **Phase commits**: each phase ends with one commit of its artifacts.
  `docs(001): spec` → `docs(001): clarify + plan` → `docs(001): tasks` →
  `feat(001): implement phase N` (≤ 10 tasks) → `test(001): integration for …`. Conventional
  Commits; scope = spec number. Never mix spec artifacts and code in one commit.
- **Gate sequence per spec**: specify → plan → constitution check → tasks → implement in ≤ 10-task
  phases → converge → review → merge. The optional enhancement steps slot in as
  `(clarify)` after specify, `(checklist)` after plan, and `(analyze)` after tasks; skipping one is
  recorded in `plan.md`, and no optional step may block a phase gate.
- **Constitution check** (from `plan.md`) is a hard gate: any "❌" needs a written justification in
  a "Complexity Tracking" section or the plan is rejected. Third-party deps, schema changes,
  provider integrations, anything touching Principles V/VI/IX, and any deviation from the design
  guideline require it.
- **Review checklist for every PR**: dependency direction (II) · aggregate ownership of the
  invariant (III) · controller single-line (IV) · tenant filter + cross-tenant test (V) · no secret
  in logs/responses (VI) · no approval path outside webhook ingress (VII) · capability checks before
  provider calls (VIII) · metering + timeline event emitted (IX) · tests green and named after the
  rule (X) · tokens/states/a11y (XI).
- **Human-in-the-loop for the product, not for the repo**: run approval lives in GitHub
  (Principle VII); the developer's own PR review stays on the PR. Agents MUST NOT open, approve, or
  merge their own PRs.
- **Model usage for development**: Claude models drive planning and implementation (via
  `/speckit-plan` and `/speckit-implement` in the coding agent). The app's own runtime agent profiles
  are a separate concern and MUST NOT reuse developer credentials or config.
- **Amendment of scope mid-spec**: new discoveries go to `/speckit-clarify` notes or `tasks.md`
  additions with a reason; scope creep creates a new spec, not extra tasks.

## Governance

- This constitution supersedes ad-hoc preferences, agent memory, `AGENTS.md`/`CLAUDE.md` hints, and
  convenience. Where guidance conflicts, this file wins; if this file is silent, the Spec Kit
  templates and the design guideline decide.
- Amendments happen only through `/speckit-constitution` (never as a side effect of a feature PR)
  and follow semantic versioning: **MAJOR** for removing/redefining a principle or making a
  backward-incompatible governance change (needs a migration plan and, for Principle V or VI, an
  explicit security review); **MINOR** for a new principle/section or materially expanded guidance;
  **PATCH** for wording, clarifications, and non-semantic fixes.
- Each amendment records: version bump + rationale, list of modified/added/removed sections,
  affected specs (update their **Constitution Check**), and a Sync Impact Report reviewed before
  committing (the report itself is not kept in the file).
- Compliance review: every task list generated by `/speckit-tasks` MUST include a
  "constitution compliance" phase, and every PR template MUST cross-check the review checklist
  above. Reviewers reject code that violates a principle even when the change is otherwise good.
- Complexity justification: patterns, layers, abstractions, or dependencies added beyond these
  principles MUST be justified in `plan.md` §Complexity Tracking, or removed.
- Exceptions are granted per PR by an organization owner/admin, MUST have an expiry date and a
  linked follow-up spec, and are recorded in `docs/governance/exceptions.md`.
- `AGENTS.md` (imported by `CLAUDE.md`) carries runtime workflow guidance generated by
  `/speckit-git-*` and the agent-context extension; it restates but never overrides this file.
  Regenerate it after each MINOR/MAJOR amendment.
- Any principle that cannot be verified by a test, a reviewable artifact, or a lint rule is
  considered mis-drafted and MUST be reworded at the next amendment.

## Ratified Defaults

Adopted here so specs do not relitigate them; change by amendment (MAJOR/MINOR as applicable). These
are **development-time defaults**, not frozen product configuration — where a value is something a
tenant or project may legitimately choose, the owning spec documents the configuration and this list
only fixes the starting default and its safe bounds.

1. CQRS is in-process command/query dispatch with one handler per request; MediatR-style free
   packages are allowed, a mediator framework is not required. No event sourcing, no external bus.
2. Domain events are persisted to a Postgres outbox and dispatched by the worker; delivery is
   at-least-once, so consumers are idempotent.
3. Tenant resolution precedence: webhook connection → project id → membership claim from the token.
   Subdomains/URL-based tenancy are out of scope for v1.
4. Judge loop defaults: mean ≥ 85 passes a phase, 1 revision attempt, ≤ 3 hard maximum. The *bounds*
   are governance (Principle IX: the loop must be finite); the *values* are owned by `specs/008-*`.
5. Budget semantics: 80 % soft warning, 100 % hard stop at the org and project level; no negative
   balance grace.
6. Pricing rows are immutable per version; org overrides are additive rows, and every ledger entry
   stores the price version it was computed from.
7. Mock LLM and Simulated repository are first-class providers (`mock`, `simulated`) selectable in
   production, not test-only fixtures — they back the demo path and the pricing/behaviour tests.
8. Verified-ingress defaults for the first build: 300 s replay window, delivery ids unique per
   connection forever (not per day). `specs/009-*` owns the protocol and may restate either value.
9. Angular consumes generated OpenAPI clients; hand-written service files are the exception and need
   a reason in `plan.md`.
10. `Public/Desgin/index.html` stays at its current path and remains the single design reference;
    implementation-specific tokens live in `client/agentix-web` styles, not in new mock files.

**Version**: 1.1.0 | **Ratified**: 2026-09-12 | **Last Amended**: 2026-09-12
