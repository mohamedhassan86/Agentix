# Data Model: Solution Foundation

**Feature**: [001-solution-foundation](./spec.md)  
**Date**: 2026-09-12  
**Storage**: PostgreSQL 16+ via Prisma 7 and the native `pg` adapter

The foundation persists only generic delivery mechanics and a removable demonstration marker. It creates no customer/business entity. Names below map to snake_case PostgreSQL objects; Application DTOs never expose ORM records.

## Conventions

- Primary keys are UUID v7 generated through an Infrastructure `IdGenerator` port implementation.
- Timestamps are `timestamptz` in UTC, sourced from an injected `Clock` in Application tests and database time for lease/claim comparisons.
- All tables use snake_case plural names.
- JSONB payloads are versioned, size-bounded, redacted before persistence, and prohibited from carrying secrets, credentials, authorization headers, cookies, full prompts/responses, or arbitrary error objects.
- `org_id` is nullable only when a closed scope discriminator is `global`; tenant scope requires it. There is no organization foreign key until spec 002 creates organizations.
- Attempts/outcomes are retained in 001 for reviewability. A later retention spec may archive/delete them.
- App/Application never issue SQL or import Prisma. Claim/reap statements that require locking are Infrastructure-only.

## Application concepts and ports

No Domain aggregate is introduced. The following are Application contracts:

### `WorkEnvelope`

A validated request to enqueue durable work:

- `workId`: UUID v7
- `type`: registered work type, max 120 characters
- `schemaVersion`: positive integer
- `scope`: `global | tenant`
- `orgId`: UUID only for tenant scope
- `idempotencyKey`: caller/server key, 1–200 characters
- `correlationId`: canonical UUID
- `traceParent`, `traceState`: optional validated W3C propagation fields
- `payload`: redacted JSON object, maximum 64 KiB serialized in 001
- `availableAt`: UTC timestamp
- `maxAttempts`: 1–10, default 3

Construction is through separate `globalWork(...)` and `tenantWork(orgId, ...)` factories. There is no factory with an optional tenant argument.

### `WorkContext`

Passed to a registered worker handler:

- envelope identifiers/scope;
- current attempt number;
- worker/lease identity;
- correlation and linked trace context;
- `AbortSignal`;
- typed, schema-validated payload.

### Ports

- `IUnitOfWork`: commits Application repository changes and work enqueue atomically.
- `IOutboxWriter`: writes a validated envelope inside the current unit of work.
- `IWorkHandlerRegistry`: maps `(type, schemaVersion)` to exactly one handler and fails on duplicate/missing entries.
- `IClock`, `IIdGenerator`, `IDiagnosticSink`: deterministic boundaries shared by later features.
- `IReadinessProbe`: returns safe dependency category/status without connection detail.

## Persisted entities

### `outbox_messages`

Durable source of truth for pending and completed asynchronous work.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid | no | Primary key, UUID v7 |
| `work_type` | varchar(120) | no | Registered name; non-empty safe character set |
| `schema_version` | integer | no | `>= 1` |
| `scope` | enum | no | `global`, `tenant` |
| `org_id` | uuid | yes | Null iff scope global; non-null iff tenant |
| `idempotency_key` | varchar(200) | no | Unique with work type and scope owner |
| `correlation_id` | uuid | no | Log/API correlation, not authorization |
| `trace_parent` | varchar(55) | yes | Validated W3C traceparent only |
| `trace_state` | varchar(512) | yes | Validated/size-bounded tracestate only |
| `payload` | jsonb | no | Versioned redacted object, ≤64 KiB at Application boundary |
| `status` | enum | no | `pending`, `processing`, `succeeded`, `failed` |
| `available_at` | timestamptz | no | Eligible when pending and due |
| `attempt_count` | smallint | no | `0..max_attempts` |
| `max_attempts` | smallint | no | `1..10` |
| `lease_owner` | varchar(120) | yes | Required only while processing |
| `lease_expires_at` | timestamptz | yes | Required only while processing |
| `last_error_code` | varchar(120) | yes | Stable allow-listed code, never message/stack/provider body |
| `created_at` | timestamptz | no | UTC |
| `started_at` | timestamptz | yes | First claim time |
| `completed_at` | timestamptz | yes | Terminal time |
| `updated_at` | timestamptz | no | UTC |

Constraints:

- primary key `(id)`;
- scope check: `(scope='global' AND org_id IS NULL) OR (scope='tenant' AND org_id IS NOT NULL)`;
- lease check: processing has owner/expiry; all other statuses have neither;
- terminal check: succeeded/failed have `completed_at`; pending/processing do not;
- attempt check: `0 <= attempt_count <= max_attempts`, max in `1..10`;
- idempotency uniqueness using normalized owner: unique `(work_type, scope, COALESCE(org_id, nil_uuid), idempotency_key)` implemented by a migration expression index;
- no mutable payload/type/scope/idempotency fields after first claim (repository policy plus database trigger/check where practical).

Indexes:

- partial claim index `(available_at, created_at, id) WHERE status='pending'`;
- partial lease recovery index `(lease_expires_at, id) WHERE status='processing'`;
- tenant diagnostics index `(org_id, created_at, id)` where `org_id IS NOT NULL` (leads with `org_id`);
- `(correlation_id, created_at, id)` for correlation lookup;
- `(status, completed_at)` for operational inspection.

### `outbox_attempts`

Append-only record of each claim and outcome.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid | no | Primary key, UUID v7 |
| `outbox_id` | uuid | no | Foreign key to outbox message |
| `org_id` | uuid | yes | Copied from tenant work for tenant-leading queries |
| `attempt_number` | smallint | no | Starts at 1 |
| `worker_id` | varchar(120) | no | Instance identity, no hostname secrets |
| `claimed_at` | timestamptz | no | UTC |
| `finished_at` | timestamptz | yes | Null while processing |
| `outcome` | enum | yes | `succeeded`, `retry_scheduled`, `failed`, `cancelled`, `lease_expired` |
| `error_code` | varchar(120) | yes | Stable safe code only |
| `next_available_at` | timestamptz | yes | Required for retry scheduled |
| `duration_ms` | integer | yes | Non-negative; set on finish |

Constraints/indexes:

- unique `(outbox_id, attempt_number)`;
- `(org_id, claimed_at, id)` for tenant work;
- `(outbox_id, claimed_at)`;
- finished/outcome/duration consistency check;
- append-only after `finished_at` except the one transition that closes its own active attempt.

### `foundation_demo_requests`

Explicitly non-business marker proving route→dispatch→transaction→worker behavior. Production exposure is disabled by default.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid | no | Primary key |
| `idempotency_key` | varchar(200) | no | Unique; caller-provided or server-created |
| `correlation_id` | uuid | no | Propagated into work |
| `requested_at` | timestamptz | no | UTC |
| `completed_at` | timestamptz | yes | Set by idempotent handler |
| `created_at`, `updated_at` | timestamptz | no | UTC |

Constraints/indexes:

- unique `idempotency_key`;
- unique `correlation_id` is not required because callers may intentionally correlate multiple operations;
- `(correlation_id, requested_at)`.

The create handler inserts this row and its outbox message in one transaction. Duplicate idempotency key returns the existing request without another message.

### `foundation_demo_effects`

The worker's visible idempotency proof.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid | no | Primary key |
| `request_id` | uuid | no | Foreign key and unique |
| `outbox_id` | uuid | no | Foreign key and unique idempotency fence |
| `correlation_id` | uuid | no | Diagnostic link |
| `applied_at` | timestamptz | no | UTC |

Constraints/indexes:

- unique `(request_id)`;
- unique `(outbox_id)`;
- `(correlation_id, applied_at)`.

Handler transaction inserts effect with conflict-safe semantics and updates request completion. Re-delivery observes the existing effect as success. Effect count can therefore only be 0 or 1.

## Closed state machines

### Outbox message

```text
Pending --claim due/attempt available--------> Processing
Processing --handler succeeds---------------> Succeeded
Processing --transient failure/attempts left-> Pending (future available_at)
Processing --permanent/max-attempt failure---> Failed
Processing --cancellation--------------------> Pending or Failed by retry policy
Processing --lease expires-------------------> Pending or Failed by retry policy
Succeeded/Failed --any processing mutation---> rejected
```

Rules:

- Claim and attempt-row insert commit in one short transaction.
- `attempt_count` increments at claim, not after execution.
- `started_at` is set once on the first claim.
- Handler runs after claim transaction commits; no database lock spans handler execution.
- Reaper owns expired-lease transition and closes the abandoned attempt as `lease_expired`.
- Retry delay is bounded exponential backoff with jitter; persisted `available_at` is source of truth.
- Unknown `(work_type, schema_version)` is permanent failure `WORK_HANDLER_NOT_REGISTERED`.
- Invalid/mismatched scope/payload is permanent failure with a stable safe code.
- Terminal records cannot be requeued in 001; an explicit future replay operation requires its own spec.

### Outbox attempt

```text
Claimed --handler succeeds------> Succeeded
Claimed --transient failure-----> RetryScheduled
Claimed --permanent/max failure-> Failed
Claimed --cooperative abort-----> Cancelled
Claimed --lease recovery--------> LeaseExpired
Terminal --change---------------> rejected
```

### Foundation demonstration

```text
Requested(effect=0) --work succeeds--> Completed(effect=1)
Requested --work retries/fails-------> Requested(effect=0), status projected from outbox
Completed --redelivery--------------> Completed(effect=1), no duplicate
```

## Transaction boundaries

| Operation | Atomic work |
| --- | --- |
| Create demo request | Insert or load request by idempotency key; on first create insert one global outbox message |
| Claim batch | Reap expired leases as needed; select due pending IDs with row locks/skip locked; mark processing/increment attempt/lease; insert attempt rows |
| Complete demo work | Insert effect idempotently; mark request completed; mark outbox succeeded; close attempt |
| Schedule retry | Close attempt with safe code/next time; clear lease; update outbox pending/available time |
| Mark failed | Close attempt; clear lease; update outbox failed/completed time/safe code |

The generic worker coordinator must allow future handlers to commit their own effect and outbox acknowledgement in one `IUnitOfWork` where effect persistence is local. External side effects rely on handler-specific idempotency keys and treat acknowledgement as a separate at-least-once boundary.

## Query projections

### `HealthResponse`

- `status`: `alive | ready`
- `service`: `agentix-web`
- `time`: ISO UTC
- `version`: public application version

Readiness failures use Problem Details and safe extension:

- `dependency`: `database | schema`
- no server name, database name, SQL, stack, or credential.

### `PingResponse`

- `status: ok`
- `service: agentix`
- `version`
- `time`
- correlation exists in response header rather than duplicated unless contract requires it.

### `FoundationWorkResponse`

- `requestId`, `workId`
- `status`: `queued | processing | succeeded | failed`
- `attemptCount`
- `effectCount`: `0 | 1`
- `requestedAt`, optional `completedAt`
- `lastErrorCode` only when failed; no payload/stack.

## Migration design

Migration name includes `001_solution_foundation` and is additive. It creates enums, four tables, foreign keys, checks, expression/partial indexes, and append/immutability safeguards. Prisma schema captures representable structures; reviewed migration SQL contains expression indexes and locking-support details.

### Deployment

1. Validate schema and generated client.
2. Apply migrations before app/worker readiness.
3. App liveness may answer while readiness returns schema-unavailable.
4. Worker refuses to claim until migration state matches.

### Rollback

Before later specs depend on the outbox, development rollback may stop worker/app and reverse 001 objects in dependency order. After downstream delivery, never drop outbox tables; roll back application artifacts and ship a forward corrective migration. No destructive automated down migration runs in production.

## Sensitive-data rules

- `DATABASE_URL` exists only in typed server config/process environment, never a row.
- Outbox JSON rejects known sensitive key names recursively and is never logged in full.
- `trace_parent`, `trace_state`, idempotency keys, error codes, and worker IDs are length/format constrained before logging/persistence.
- Error rows contain stable codes only, not free-form exception messages.
- Test fixtures seed a unique secret marker through request headers, nested payload, thrown error, and environment values and assert zero occurrence in all output sinks.
