# Feature Specification: Solution Foundation

**Feature Branch**: `001-solution-foundation`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Specify the missing solution foundation required by tenancy and identity: a compiling application host, enforced architecture boundaries, stable API and error baseline, durable persistence and background-work foundations, observability, canonical design tokens, continuous-integration and test gates, with no business entities."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run the product skeleton locally (Priority: P1)

A developer checks out the repository, follows one documented setup path, and starts the web application and background worker without needing a paid account, external provider token, or product data. They can open a minimal branded page and confirm that the application and its required backing services are healthy.

**Why this priority**: Every later feature needs a reproducible host before it can add business behavior. If a fresh checkout does not run, no vertical slice can be implemented or reviewed reliably.

**Independent Test**: From a clean checkout with the documented prerequisites, install dependencies, initialize local backing services, start the application and worker, open the root page, and observe healthy readiness within 10 minutes without entering third-party credentials.

**Acceptance Scenarios**:

1. **Given** a clean checkout and the documented local prerequisites, **When** a developer follows the quickstart, **Then** the application and worker start successfully and a branded foundation page is reachable within 10 minutes.
2. **Given** all required local backing services are available, **When** the developer requests the liveness and readiness checks, **Then** liveness reports that the process is running and readiness reports that required dependencies can serve work.
3. **Given** a required server setting is absent or invalid, **When** a process starts, **Then** it fails before accepting work with a message that identifies the setting name and remediation but never prints a secret value.
4. **Given** no paid provider credentials or source-host tokens, **When** the developer starts the foundation, **Then** every foundation capability remains testable and no outbound paid/provider call is attempted.

---

### User Story 2 - Add a vertical slice without crossing boundaries (Priority: P1)

A feature developer has clear, pre-created places for business rules, use cases, adapters, web entry points, worker entry points, and tests. Automated checks reject an inward layer that depends on a framework, persistence adapter, network client, or user-interface type, so a later feature cannot silently turn the folder layout into an unenforced convention.

**Why this priority**: Tenancy, secrets, workflow state, and metering are safety-critical. Their rules must remain independently testable as infrastructure changes.

**Independent Test**: Add a temporary forbidden inward dependency in a validation fixture and confirm the architecture check fails with both source and target boundaries; restore it and confirm the check passes.

**Acceptance Scenarios**:

1. **Given** the clean foundation, **When** all architecture checks run, **Then** the approved dependency direction passes with zero exceptions.
2. **Given** a rule-bearing inner module imports an outer framework or adapter in a validation fixture, **When** architecture checks run, **Then** the build fails and identifies the violated boundary.
3. **Given** an application use case and aggregate, **When** they are exercised in isolation, **Then** they can be constructed and tested without a database, network, web request, or running worker.
4. **Given** a web operation in the foundation, **When** its entry point is reviewed, **Then** request parsing and one use-case dispatch are the only operation-specific responsibilities; error conversion, correlation, and logging are shared behavior.

---

### User Story 3 - Depend on one stable HTTP and error baseline (Priority: P1)

A client or later feature calls a versioned ping operation and receives a documented JSON result, a correlation identifier, and consistent error documents for invalid or failed requests. A reviewer can compare the published contract with actual responses and detect drift automatically.

**Why this priority**: Every later API surface needs one versioning, validation, correlation, and error convention. Establishing it once prevents incompatible route-by-route behavior.

**Independent Test**: Call the versioned ping operation and a deliberately invalid foundation request, verify status, content type, response schema, stable error code, and correlation identifier against the committed contract.

**Acceptance Scenarios**:

1. **Given** a running application, **When** a caller requests the versioned ping operation, **Then** it receives a success response with service status, current time, and a correlation identifier.
2. **Given** a request without a valid incoming correlation identifier, **When** it is handled, **Then** the system assigns one and returns it in the response; a valid supplied identifier is propagated.
3. **Given** invalid input or a known rule failure, **When** the request is rejected, **Then** the caller receives one documented problem format with status, stable code, human-readable detail, and the same correlation identifier.
4. **Given** the committed machine-readable API contract, **When** contract validation runs, **Then** the live foundation responses conform and uncommitted contract drift fails the gate.
5. **Given** a browser client, **When** it calls a product API, **Then** it uses the same origin and the shared typed client boundary rather than a hard-coded service host.

---

### User Story 4 - Persist and dispatch background work safely (Priority: P2)

A later use case can save a state change and a background-work request as one durable action. A worker claims available work, records success or failure, retries transient failure within a bounded policy, avoids duplicate effects, and can stop cooperatively. A reviewer can prove this without introducing any product-specific job.

**Why this priority**: Invitations, hooks, metering, and provider writes all need reliable background work. Without one foundation path, later features will invent incompatible queues or unsafe dual writes.

**Independent Test**: Use a foundation demonstration job to commit a state marker and work request together, interrupt/retry delivery, and verify the effect occurs exactly once while attempts remain observable.

**Acceptance Scenarios**:

1. **Given** a use case that records state and requests background work, **When** its transaction commits, **Then** both records are durable; when it rolls back, neither remains.
2. **Given** an available work item, **When** two worker instances attempt to claim it concurrently, **Then** at most one owns that attempt and the externally visible effect is applied once.
3. **Given** a transient processing failure, **When** the retry policy runs, **Then** attempts are bounded, delayed, and recorded without losing the item or retrying forever.
4. **Given** the same item is delivered more than once, **When** an idempotent handler processes it, **Then** only one externally visible result exists.
5. **Given** a shutdown or cancellation request, **When** the worker is processing or waiting, **Then** it stops accepting new work and exits without abandoning a claimed item in an unrecoverable state.
6. **Given** no tenant has been resolved for future tenant-scoped work, **When** such a job is submitted, **Then** it is rejected rather than running without a tenant boundary; foundation-global jobs remain explicitly distinguishable.

---

### User Story 5 - Trust the quality and operational baseline (Priority: P2)

A developer or reviewer runs one standard gate sequence and gets deterministic results for style, tests, production build, dependency licensing, migrations, contracts, and architecture. Operators can correlate a request across structured logs and traces, while health checks and baseline metrics reveal whether the application and worker are available. The minimal page demonstrates the canonical visual tokens and accessibility defaults used by later screens.

**Why this priority**: A foundation is valuable only if regressions are caught mechanically and failures can be diagnosed without exposing sensitive values.

**Independent Test**: Run every documented gate from a clean checkout, exercise ping and a demonstration background item, correlate their telemetry by identifier, and inspect the foundation page using keyboard and reduced-motion settings.

**Acceptance Scenarios**:

1. **Given** a clean valid checkout, **When** the standard gate sequence runs, **Then** lint, tests, production build, license, architecture, migration, and contract checks all pass with no suppressed warnings.
2. **Given** a prohibited dependency license, skipped test, contract drift, invalid migration, or boundary violation in a validation fixture, **When** the relevant gate runs, **Then** the gate fails with an actionable reason.
3. **Given** a request and a related background item, **When** they execute, **Then** structured diagnostics carry correlation and work identifiers so a reviewer can follow the path without searching free-form text.
4. **Given** secrets or seeded sensitive marker values in test input, **When** requests fail and work retries, **Then** zero marker values appear in responses, logs, traces, metrics, or committed artifacts.
5. **Given** the foundation page, **When** it is inspected in default, keyboard-only, narrow-screen, and reduced-motion modes, **Then** canonical color/spacing/type tokens are visible, focus is perceivable, text remains readable, and motion preference is honored.

### Edge Cases

- **Database unavailable at startup**: liveness remains process-focused; readiness fails with a stable dependency code and no connection details or credentials.
- **Database becomes unavailable after startup**: affected requests/work fail in a bounded way, readiness changes accordingly, and recovery does not require a process restart when the dependency returns.
- **Two workers claim the same item**: claim ownership and idempotency prevent duplicate visible effects.
- **Worker crashes after applying an effect but before acknowledging**: redelivery is safe and does not repeat the effect.
- **Malformed work payload or unsupported version**: item is rejected with a stable reason after bounded handling; it is not retried forever and does not crash the worker loop.
- **Cancellation during work**: cancellation is propagated; the item becomes retryable or terminal according to its recorded outcome, never silently disappears.
- **Caller supplies a malformed or excessively long correlation identifier**: it is replaced by a valid generated identifier and the malformed value is not echoed.
- **Unexpected exception contains sensitive text**: client and telemetry receive a stable generic failure; tests prove the sensitive marker is absent.
- **Migration is applied twice**: the second deployment is safe and the schema remains at the expected version.
- **Migration fails partway**: startup/deployment reports failure without claiming readiness; recovery steps are documented.
- **Browser is offline or the API is unavailable**: the foundation page shows an explicit error state and retry action rather than an indefinite loader.
- **Reduced-motion or high zoom is enabled**: content remains operable without animation or horizontal loss of primary actions.
- **No tenant model exists yet**: the foundation provides tenant-aware extension points and deny-by-default contracts but creates no organization, account, project, secret, run, or billing record.

## Requirements *(mandatory)*

### Functional Requirements

#### Runnable hosts and configuration

- **FR-001**: The repository MUST provide one documented installation and startup path for the web application and one for the background worker from a clean checkout.
- **FR-002**: The foundation MUST expose a minimal branded page, a liveness check, a readiness check, and one versioned ping operation without requiring user accounts or product data.
- **FR-003**: Liveness MUST indicate process availability only. Readiness MUST verify all dependencies required to accept the relevant class of work and MUST identify unavailable dependency categories without exposing connection details.
- **FR-004**: Server and worker settings MUST be validated before accepting work. Missing or invalid required settings MUST fail fast with the setting name and safe remediation; secret values MUST never be printed or exposed to browser-visible configuration.
- **FR-005**: Foundation development and validation MUST require no paid provider, source-host token, mailbox provider, or cloud key-management account.
- **FR-006**: The web client MUST call product operations through a same-origin shared client boundary; browser-visible code MUST NOT require a separately configured service host or receive server-only settings.

#### Enforced module boundaries

- **FR-007**: The repository MUST define separate locations for business rules, application use cases and ports, infrastructure adapters, web entry/composition, worker entry/composition, and tests.
- **FR-008**: Automated checks MUST enforce inward-only dependency direction and MUST report both sides of a forbidden dependency.
- **FR-009**: Business-rule modules MUST be testable without starting a web server, worker, database, queue, or network service.
- **FR-010**: Application use cases MUST depend on contracts for persistence, time, identifiers, telemetry, and background work rather than concrete adapters.
- **FR-011**: Web operation entry points MUST be limited to typed request parsing and one command/query dispatch. Authentication, tenant binding, correlation, validation failure mapping, logging, and unexpected-error handling MUST be shared pipeline behavior.
- **FR-012**: Worker handlers MUST receive explicit work context, an idempotency identity, and cancellation, and MUST NOT depend on request-local ambient state.

#### HTTP and error contract

- **FR-013**: Product HTTP operations MUST be versioned from their first public contract; the foundation ping operation MUST exercise that versioned surface.
- **FR-014**: Every HTTP response MUST carry a valid correlation identifier. A valid caller-supplied identifier MAY be propagated; malformed input MUST be replaced and not echoed.
- **FR-015**: Every non-success HTTP response MUST use one documented problem format containing type, title, status, stable machine code, correlation identifier, and safe human-readable detail; validation failures MUST identify fields without echoing sensitive input.
- **FR-016**: The foundation MUST provide one machine-readable contract source and an automated drift/conformance check for committed and live API behavior.
- **FR-017**: The shared client boundary MUST derive its request/response expectations from the same contract source used by the server.
- **FR-018**: Cross-origin browser access MUST be denied unless an origin is explicitly allowed by server configuration; same-origin access is the default.

#### Persistence and background work

- **FR-019**: The foundation MUST provide a versioned migration path against an isolated local/test relational data store and MUST report the currently applied schema state.
- **FR-020**: Foundation migrations MUST be additive and reversible in development. Failed or unapplied required migrations MUST prevent readiness rather than permitting requests against an unknown schema.
- **FR-021**: A use case MUST be able to persist a state change and its background-work request atomically so that both commit or both roll back.
- **FR-022**: A durable work item MUST include a unique identity, type, schema version, explicit tenant identity or explicit foundation-global classification, creation/availability timestamps, attempt count, and processing status.
- **FR-023**: The worker MUST claim work safely across concurrent instances, use bounded retries with delay for transient failures, record terminal failure, and never retry indefinitely.
- **FR-024**: Work delivery MUST be at least once and handlers MUST support an idempotency mechanism that prevents duplicate externally visible effects.
- **FR-025**: The worker MUST support graceful shutdown and propagated cancellation; interrupted claims MUST become safely recoverable.
- **FR-026**: Tenant-scoped work without an explicit tenant identity MUST fail closed. The foundation MUST NOT invent a fallback tenant or infer tenant identity from ambient worker state.
- **FR-027**: Demonstration persistence and work records MUST remain foundation-only and MUST NOT introduce business entities or simulate future product behavior through privileged shortcuts.

#### Diagnostics, design baseline, and quality gates

- **FR-028**: Requests and work attempts MUST produce structured diagnostics with timestamp, severity, correlation identifier, operation/work identity, status, and safe error code; applicable tenant/project/run dimensions MUST have explicit empty values until later features provide them.
- **FR-029**: The foundation MUST provide trace correlation across request dispatch, persistence, work claim, and demonstration handler execution, plus baseline availability, duration, and failure counters for web and worker hosts.
- **FR-030**: Logs, traces, metrics, errors, health responses, contracts, and demonstration payloads MUST NOT contain secret values, connection strings, authorization material, or full prompt/response bodies. Automated tests MUST use seeded markers to verify zero leakage.
- **FR-031**: The foundation page MUST establish the canonical product name, design tokens, base typography, focus treatment, reduced-motion behavior, responsive shell, and reusable status/banner/card/form/button patterns from the design guideline.
- **FR-032**: The foundation page MUST have explicit loading, ready, dependency-error, and retry states; status MUST never be communicated by color alone.
- **FR-033**: Interactive foundation controls MUST be keyboard operable, visibly focused, labelled, readable at 200% zoom, and meet the required text/icon contrast levels.
- **FR-034**: The repository MUST expose one standard verification sequence that runs style/static checks, unit and integration tests, architecture checks, migration validation, API contract checks, production build/type validation, and dependency-license validation.
- **FR-035**: The verification sequence MUST fail on suppressed warnings, skipped tests without a linked issue, placeholder assertions, prohibited dependency licenses, contract drift, migration failure, architecture violations, and production-build failure.
- **FR-036**: Test reports MUST enforce at least 90% line coverage for rule-bearing business modules and at least 80% for application handlers once those modules exist; the empty foundation MUST still prove its own error, dispatch, outbox, worker, configuration, and health behavior with named tests.
- **FR-037**: Continuous integration MUST run the same standard verification sequence used locally and MUST publish enough safe diagnostics to identify the failed gate.
- **FR-038**: The foundation MUST document exact reviewer steps for install, migration, startup, health, ping, demonstration work dispatch, diagnostics correlation, and the complete verification sequence.

### Key Entities

- **Service health snapshot**: A point-in-time view of process liveness or dependency readiness, with status, safe dependency categories, current time, and correlation identity. It contains no credentials or connection details.
- **Problem response**: The uniform non-success contract with stable machine code, safe detail, status, and correlation identity.
- **Work item**: A durable request for asynchronous processing with unique/idempotency identity, type/version, explicit scope, availability, attempts, and lifecycle status.
- **Work attempt**: An observable claim/processing outcome for a work item, including timing, worker identity, result code, and retry decision without sensitive payload data.
- **Foundation demonstration record**: A non-business marker used only to prove atomic persistence and idempotent dispatch; it does not model any future customer concept.
- **Diagnostic context**: Correlation and operation/work dimensions propagated across web, application, persistence, and worker execution.
- **Design token set**: The canonical named colors, spacing, radius, typography, and layout values that later user-interface features reuse.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with documented prerequisites can move from clean checkout to a reachable foundation page, healthy readiness, and running worker in under 10 minutes without external credentials.
- **SC-002**: 100% of foundation HTTP responses include a valid correlation identifier, and 100% of tested error responses conform to the documented problem shape and stable code catalog.
- **SC-003**: 100% of intentionally forbidden dependency fixtures fail the architecture gate, while the unmodified repository reports zero boundary violations.
- **SC-004**: In 100 concurrent claim attempts against one demonstration work item, exactly one externally visible effect is produced; repeated delivery still leaves exactly one effect.
- **SC-005**: Committed state and background-work requests are both present after 100% of successful transaction tests and both absent after 100% of forced rollback tests.
- **SC-006**: Transient work failures stop at the configured finite attempt ceiling in 100% of tests, and cancellation/shutdown tests leave zero permanently stranded claims.
- **SC-007**: Seeded secret markers appear zero times across response bodies, health output, structured logs, traces, metrics, contract files, failure diagnostics, and committed artifacts.
- **SC-008**: The complete local and continuous-integration verification sequence produces the same pass/fail result for style, tests, architecture, migrations, contracts, build, and licenses in 100% of validation fixtures.
- **SC-009**: A reviewer can correlate a ping request and its demonstration background work from entry to terminal outcome using one correlation identity in under 2 minutes without reading unstructured log text.
- **SC-010**: The foundation page passes all documented keyboard, focus, reduced-motion, 200% zoom, responsive-width, and contrast checks with zero critical accessibility findings.
- **SC-011**: Liveness and readiness reflect process and dependency state correctly in 100% of healthy, missing-configuration, database-unavailable, migration-pending, and recovered-dependency tests.
- **SC-012**: The foundation introduces zero customer account, organization, membership, project, secret, run, metering, billing, or source-provider records and performs zero paid/external provider calls.

## Assumptions

- This is roadmap feature **001**, deliberately created after the 002 specification was drafted because 002 exposed the missing prerequisite. Delivery order remains 001 before implementation of 002.
- The foundation is a developer/operator capability rather than a customer-facing product feature. Its only page is a branded health/pattern demonstration, not the full console or authentication experience.
- A local isolated relational data service is available through the documented setup; hosted development databases may be supported later without changing the required behavior.
- One web host and one worker host are enough for the initial solution. Horizontal concurrency is validated for claims even if local quickstart runs one worker.
- Foundation demonstration records and routes are non-privileged operational examples. They MUST NOT become test-only bypasses for later business workflows and MAY be removed/replaced once real vertical slices prove the same infrastructure.
- Tenant isolation hooks are established as interfaces and fail-closed scope classification here; user/organization membership and tenant-filtered business records belong to spec 002.
- Secret-vault encryption, source providers, LLM calls, metering, budgets, run orchestration, hooks/Judge, webhook verification, and console screens belong to later numbered specs.
- The canonical UI reference is `Public/Desgin/index.html`; implementation-specific deviations, if any, are recorded during planning.
- Operational retention periods and production hosting vendor selection are deployment decisions unless a later feature makes them customer-visible.

## Out of Scope

- User registration, authentication, sessions, organizations, memberships, roles, invitations, or platform administration.
- Customer projects, repository mapping, provider integrations, simulated repositories, agents, skills, runs, hooks, Judge behavior, timelines, metering, budgets, billing, or approval workflows.
- Secret-vault data encryption, organization data keys, cloud key-management integration, webhook signing, or customer credential storage.
- A production email, source-host, LLM, payment, or notification provider.
- Full application navigation and console pages beyond the minimal branded foundation status/pattern page.
- Production infrastructure provisioning, domain/DNS management, managed database creation, or vendor-specific deployment automation.
- Product-specific background jobs or a general external message-broker platform.

## Constitution Check

Re-read performed on 2026-09-12: `.specify/memory/constitution.md` v2.0.0; `Public/Desgin/index.html`; and the existing draft feature 002 artifacts (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`). No feature is already delivered. Feature 002 is not treated as a predecessor; it is a downstream consumer whose explicitly identified foundation needs constrain this slice.

| Principle | Binding on this spec? | How |
| --- | --- | --- |
| I. Spec-driven delivery | Yes | Feature 001 is isolated under `specs/001-solution-foundation/`; no code is introduced. Clarify is optional and may be skipped in the plan because this spec defines no business state machine, money rule, or authorization boundary. The hosted Arena session is pinned to `arena/01a09554-agentix`; the mandatory branch hook was invoked but could not reuse the existing branch, and higher-level session policy forbids switching/creating another branch. |
| II. Clean architecture | Yes | The foundation must make the prescribed boundaries usable and mechanically enforce dependency direction. Concrete enforcement belongs in `plan.md`. |
| III. Rich domain model | Partial | No business aggregate is in scope. The demonstration record must remain non-business; outbox/work transitions are explicit infrastructure state, not a substitute domain model. |
| IV. Thin route handlers | Yes | Ping/health/demonstration operations prove shared parsing, dispatch, correlation, and error behavior without route-specific business branching. |
| V. Tenant isolation | Foundation only | Explicit scoped/global work classification and fail-closed missing tenant context are established. Tenant entities and filters are deferred to 002; no tenant data exists here. |
| VI. Secrets ciphertext | Boundary only | No customer secret is stored. Configuration and seeded-sensitive-marker tests prove secret values never reach client-visible config or diagnostics. Vault/envelope behavior remains spec 003. |
| VII. Verified ingress only approval | Yes as a prohibition | No approval endpoint, state transition, simulator shortcut, or source-host ingress exists. |
| VIII. Provider neutrality | No | No source provider contract or adapter is introduced; spec 004 owns it. |
| IX. Hooks and metering | Partial | Durable outbox/worker mechanics are established, but no agent hook, LLM call, timeline, price, or budget behavior exists. |
| X. Test-gated DoD | Yes | Standard local/CI gates, real-data-service integration tests, architecture/contract/license checks, coverage configuration, and reviewer quickstart are user-visible deliverables. |
| XI. Design fidelity | Yes | Canonical tokens, typography, base components, states, responsiveness, focus, contrast, and reduced motion appear on the minimal foundation page; no new visual language is invented. |

No constitution exception is requested. The branch-hook limitation is imposed by the hosted session and does not change feature scope or artifact location.
