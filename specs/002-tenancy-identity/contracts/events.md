# Event Contracts: Tenancy & Identity

**Feature**: [002-tenancy-identity](../spec.md)  
**Version**: 1

Two channels are deliberately distinct:

1. **Identity facts** are redacted, append-only records persisted with the aggregate transaction and suitable for a future audit viewer.
2. **Message delivery requests** are internal outbox commands whose token-bearing content is encrypted and never appears in an identity fact, log, trace, API body, or dead-letter diagnostic.

No event in this document is an external public webhook in spec 002.

## Common identity fact envelope

```json
{
  "eventId": "0199...uuid",
  "eventVersion": 1,
  "eventType": "membership.role_changed",
  "organizationId": "0199...uuid-or-null",
  "actorUserId": "0199...uuid-or-null",
  "subjectUserId": "0199...uuid-or-null",
  "objectType": "membership",
  "objectId": "0199...uuid",
  "sequence": "42",
  "occurredAt": "2026-09-12T12:00:00.000Z",
  "data": {
    "fromRole": "member",
    "toRole": "admin"
  }
}
```

Rules:
- UUIDs and stable enum/reason values are allowed.
- `sequence` serializes as a decimal string to avoid JavaScript integer loss.
- `data` MUST NOT contain password/hash, raw or digested invitation/verification/session token, encrypted payload, auth cookie, full request body, provider error body, or secret config.
- Email is omitted from the common event stream. An invitation is correlated by `objectId`; authorized future projections may resolve its email under tenant scope.
- Event consumers are idempotent by `eventId` and reject unsupported major `eventVersion`.

## Event catalog

| Event type | Organization | Actor | Subject | Allowed `data` |
| --- | --- | --- | --- | --- |
| `account.registered` | null | subject | user | `{ "verified": false }` |
| `account.email_verified` | null | subject | user | `{ "result": "verified" | "already_verified" }` |
| `account.deleted` | null | subject | user | `{ "reason": "self_service" }` |
| `organization.created` | required | creator | creator | `{ "slug": "..." }` |
| `organization.profile_changed` | required | Owner | null | changed field names and old/new slug only; no arbitrary patch |
| `organization.ownership_transferred` | required | former Owner | new Owner | `{ "formerOwnerUserId": "...", "newOwnerUserId": "..." }` |
| `organization.deleted` | required | Owner | null | `{ "slug": "...", "reason": "owner_confirmed" }` |
| `membership.joined` | required | invite acceptor or creator | member | `{ "role": "viewer|member|admin|owner", "source": "creation|invitation|rejoin" }` |
| `membership.role_changed` | required | Owner/Admin | member | `{ "fromRole": "...", "toRole": "..." }` |
| `membership.removed` | required | Owner/Admin | member | `{ "formerRole": "..." }` |
| `membership.left` | required | subject | subject | `{ "formerRole": "..." }` |
| `invitation.created` | required | Owner/Admin | null | `{ "role": "viewer|member|admin", "deliveryState": "queued" }` |
| `invitation.resent` | required | Owner/Admin | null | `{ "role": "...", "tokenVersion": 2 }` |
| `invitation.revoked` | required | Owner/Admin | null | `{ "previousStatus": "pending" }` |
| `invitation.expired` | required | null | null | `{ "expiredAt": "..." }` |
| `invitation.accepted` | required | invitee | invitee | `{ "role": "..." }` |
| `message.delivery_succeeded` | optional | null | null | `{ "messageKind": "verification|invitation", "attempt": 1 }` |
| `message.delivery_failed` | optional | null | null | `{ "messageKind": "verification|invitation", "attempt": 1, "errorCode": "stable_redacted_code" }` |

Sign-in failure/success is security telemetry rather than an append-only identity lifecycle event in this feature. Telemetry never contains normalized email; it may contain the one-way throttle key and correlation ID under the foundation's retention policy.

## Internal message-delivery command

The outbox metadata visible to dispatch contains only:

```json
{
  "messageId": "0199...uuid",
  "messageKind": "invitation",
  "recipientHash": "sha256:base64url...",
  "keyVersion": 1,
  "availableAt": "2026-09-12T12:00:00.000Z",
  "attempt": 0
}
```

The outbox row separately contains AES-256-GCM `ciphertext`, 12-byte `nonce`, and 16-byte authentication tag. Authenticated data binds message ID, kind, recipient hash, and key version. After decryption inside the delivery adapter, the plaintext schema is:

```json
{
  "recipient": "person@example.com",
  "template": "invitation",
  "parameters": {
    "organizationName": "Northstar Labs",
    "inviterDisplayName": "Alex Kim",
    "role": "member",
    "actionUrl": "https://agentix.example/invitations/0199...?token=ONE_TIME_SECRET",
    "expiresAt": "2026-09-19T12:00:00.000Z"
  }
}
```

Verification uses template `email-verification` with display name, action URL, and 24-hour expiry. Plaintext is transient and MUST NOT be included in exception messages, retries, traces, or dead-letter projections. Captured-message test storage is access-controlled test infrastructure and is reset between tests.

## Idempotency and ordering

- Aggregate mutation and event/outbox insert occur in one PostgreSQL transaction.
- Event uniqueness: `eventId`; organization order: `(organizationId, sequence)`.
- Message dispatch uniqueness: `messageId`; retries do not create a second issued token.
- Resend creates a new token version and a new message ID, and revokes all prior unconsumed versions in the same transaction.
- Accept/revoke/expire race is serialized by locking the invitation and current token. Exactly one terminal transition commits.
- Consumers tolerate at-least-once delivery and never infer current authorization from an event; current membership is loaded from source-of-truth tables.
