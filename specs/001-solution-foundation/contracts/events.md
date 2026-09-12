# Internal Work Contracts: Solution Foundation

**Feature**: [001-solution-foundation](../spec.md)  
**Envelope version**: 1

These are internal transactional-outbox contracts, not public webhooks or an inter-agent protocol. They establish the durable carrier reused by later specs. No contract can approve a run, call a provider, carry a credential, or infer a tenant from ambient state.

## Envelope v1

```json
{
  "id": "0199f000-0000-7000-8000-000000000001",
  "type": "foundation.demo.requested",
  "schemaVersion": 1,
  "scope": "global",
  "orgId": null,
  "idempotencyKey": "foundation-demo:0199f000-0000-7000-8000-000000000002",
  "correlationId": "0199f000-0000-7000-8000-000000000003",
  "trace": {
    "traceParent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    "traceState": null
  },
  "createdAt": "2026-09-12T12:00:00.000Z",
  "availableAt": "2026-09-12T12:00:00.000Z",
  "maxAttempts": 3,
  "payload": {
    "requestId": "0199f000-0000-7000-8000-000000000002"
  }
}
```

### Envelope rules

- `id`, `orgId`, and `correlationId` are canonical UUIDs; generated IDs use UUID v7.
- `type` is a registered lowercase dot-separated identifier, 1–120 characters.
- `schemaVersion` is a positive integer. Handler lookup is exactly `(type, schemaVersion)`.
- `scope` is closed: `global | tenant`.
- Global requires `orgId=null`; tenant requires a non-null `orgId`. Missing/mismatched tenant scope is a permanent failure before handler execution.
- `idempotencyKey` is 1–200 characters and unique within work type/scope owner.
- `traceParent` and `traceState` are optional, validated W3C fields. Invalid caller trace context is discarded rather than propagated.
- `payload` is an object, not an arbitrary scalar, and is limited to 64 KiB serialized in v1.
- Payload schema is registered by work type/version and validated both before enqueue and before processing.
- Persisted envelope fields are immutable after first claim, except status/attempt/lease/outcome metadata outside this serialized contract.

## Sensitive data prohibition

The envelope and payload MUST NOT contain:

- passwords, cookies, authorization headers, API keys, access/refresh/session tokens;
- connection strings, KMS/key material, webhook secrets/signatures;
- full prompts/responses, source file content, arbitrary request/response bodies;
- raw exception messages, stacks, provider payloads, or unbounded user input.

Infrastructure applies recursive sensitive-key rejection and size checks as defense in depth. Work-type owners remain responsible for typed allow-list payload schemas. Logs and span attributes include envelope metadata only and never serialize `payload`.

Future specs that require confidential delivery material must add an encrypted payload envelope under their own security plan; plaintext is not placed into v1 JSONB merely because it is internal.

## Foundation demonstration event

### Type

`foundation.demo.requested` version `1`, scope `global` only.

### Payload

```json
{
  "requestId": "0199f000-0000-7000-8000-000000000002"
}
```

Rules:

- `requestId` references the non-business foundation demonstration request.
- No additional properties.
- Handler inserts one effect under unique `workId` and `requestId` fences.
- Re-delivery after the effect exists is successful and does not add another effect.
- The type is never repurposed for accounts, organizations, runs, providers, approvals, or any customer operation.

## Handler result

Handlers return a closed coordinator result; they do not mutate queue state directly outside an Infrastructure unit of work.

```ts
// Contract shape, not an implementation body.
type WorkResult =
  | { outcome: "succeeded" }
  | { outcome: "retry"; code: SafeErrorCode; retryAt?: Instant }
  | { outcome: "failed"; code: SafeErrorCode };
```

- Thrown cancellation maps to `cancelled` attempt and a retry/fail decision based on attempts.
- Unknown handler/version, invalid schema, or scope mismatch is permanent failure.
- Unexpected exceptions are logged through safe serializers and stored only as `WORK_UNEXPECTED_FAILURE`.
- A retry time cannot exceed configured bounds and is persisted as source of truth.

## Delivery and ordering

- Delivery is at least once.
- No global ordering guarantee exists across work items.
- Claim order is `(availableAt, createdAt, id)` among currently unlocked eligible rows.
- A worker may process claimed items concurrently up to its configured bound; each item has its own lease.
- Consumers MUST be idempotent by `id` or a stronger domain-specific idempotency key.
- Queue success does not imply external exactly-once delivery; a future external adapter must provide its own idempotent write key.

## Trace propagation

- Enqueue captures validated W3C trace context into envelope metadata.
- Worker creates a processing span linked to or parented from the enqueue context according to OpenTelemetry durable-messaging conventions.
- `correlationId` is copied into structured logs and safe response metadata; it is distinct from trace ID.
- UUIDs and work IDs are span attributes only where useful for trace lookup; they are never metric labels.

## Versioning

- Additive optional fields may retain the same envelope version when old consumers ignore them safely.
- Breaking field/meaning changes require envelope v2.
- Work payload breaking changes require a new `schemaVersion`; old registered versions remain processable while rows exist.
- Removing a handler version is forbidden while pending/processing rows of that version remain.
