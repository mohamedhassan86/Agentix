# Data Model: Tenancy & Identity

**Feature**: [002-tenancy-identity](./spec.md)  
**Date**: 2026-09-12  
**Storage**: PostgreSQL 16+ through Prisma; additive migration `*_002_tenancy_identity`

This document describes logical entities and persistence constraints. Names are indicative for the Prisma/PostgreSQL mapping; Domain types remain persistence-ignorant.

## Conventions

- IDs are UUIDs generated in time-sortable/sequential form by the foundation's selected UUID-v7-compatible mechanism.
- All timestamps are `timestamptz` in UTC. Domain code receives a `Clock` port; tests never depend on wall time.
- Emails are trimmed and normalized to Unicode-normalized lowercase for equality. `email_normalized` is globally unique; display/delivery uses the normalized value in this phase.
- Organization-scoped records have non-null `org_id`; indexes for tenant queries lead with `org_id`.
- Logical deletion/end state is represented by timestamps and reasons, not physical deletion.
- Password hashes, session tokens, verification/invitation tokens, and encrypted outbox payloads are write-only persistence fields and never DTO fields.
- Optimistic `version` values protect aggregate writes; ownership transfer additionally locks the organization row and uses a serializable transaction.

## Aggregate boundaries

### UserAccount aggregate

Owns registration state, email verification status, platform-administrator compatibility, and logical account deletion. Password verification is an Application port because Argon2 is infrastructure; the account decides whether authentication is permitted.

Behavior:
- `register(email, displayName, passwordHash)`
- `markVerified(tokenSubject, now)`
- `markDeleted(now)`
- `grantPlatformAdministrator(activeMembershipCount)` (out-of-band only)
- `revokePlatformAdministrator()` (out-of-band only)

Invariants:
- email is globally unique case-insensitively;
- deleted accounts cannot authenticate, verify anew, create/join/switch organization, or accept invitations;
- platform administrators have zero active memberships and no active organization;
- account deletion is rejected while the user is sole Owner of any non-deleted organization.

### Organization aggregate

Owns organization profile, membership set, role changes, member removal/leave, ownership transfer, and logical deletion. Membership is an entity inside this consistency boundary for mutation even though queries use projections.

Behavior:
- `create(creator, name, slug)`
- `rename(owner, name, slug)`
- `changeRole(actor, member, role)`
- `removeMember(actor, member)`
- `leave(member)`
- `transferOwnership(owner, targetMember)`
- `delete(owner, confirmationSlug)`

Invariants:
- every non-deleted organization has exactly one active Owner membership;
- Owner cannot be assigned by invite/general role change;
- Owner cannot leave, be removed, or be downgraded;
- transfer target is an active non-Owner member in the same organization;
- transfer atomically demotes former Owner to Admin and promotes target;
- slug is globally unique including deleted organizations;
- platform administrators cannot become members or create organizations;
- deleted organizations resolve no active tenant access and cannot mutate.

### Invitation aggregate

Owns one invitation's role offer, token versions, resend/revoke/expire/accept transitions, and message-delivery request creation.

Behavior:
- `issue(org, inviter, email, role, tokenDigest, expiresAt)`
- `expire(now)`
- `resend(actor, newDigest, newExpiry)`
- `revoke(actor, now)`
- `accept(user, tokenDigest, now)`

Invariants:
- role is Admin, Member, or Viewer, never Owner;
- only Owner/Admin may issue/list/resend/revoke;
- at most one pending effective invitation exists per `(org_id, email_normalized)`;
- existing active member and platform-admin email cannot be invited;
- accept requires exact normalized account email and active organization;
- each token version is single-use and resend invalidates prior versions;
- acceptance and membership creation commit atomically;
- delivery failure does not change invitation status.

### Session aggregate

Owns opaque session lifecycle and the selected organization pointer. It does **not** own authoritative role.

Behavior:
- `start(user, expiry)` with no active organization
- `selectOrganization(currentMembership)`
- `clearOrganization()`
- `revoke()`
- `rotate()`

Invariants:
- active organization is null at sign-in;
- selecting requires a current membership and non-deleted organization;
- role is resolved at request evaluation time and is not persisted as authority;
- removed membership, deleted organization, or platform privilege clears/rejects the active pointer on next evaluation;
- sign-out makes the token unusable immediately.

## Entities

### `users`

| Field | Type | Rules |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `email_normalized` | text | Required, trimmed/lowercase, unique |
| `display_name` | text | Required, 1–120 Unicode characters after trim |
| `password_hash` | text | Required PHC Argon2id string; write-only |
| `email_verified_at` | timestamptz nullable | Null means unverified |
| `is_platform_admin` | boolean | Default false; out-of-band mutation only |
| `deleted_at` | timestamptz nullable | Logical deletion |
| `created_at`, `updated_at` | timestamptz | Required |
| `version` | integer | Optimistic concurrency |

Constraints/indexes:
- unique `email_normalized`;
- index `(is_platform_admin, deleted_at)` for operator validation;
- database trigger rejects setting `is_platform_admin=true` when an active membership exists.

### `organizations`

| Field | Type | Rules |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `name` | text | Required, 1–120 chars after trim |
| `slug` | varchar(48) | Required; regex `^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$`; minimum 3 |
| `owner_user_id` | uuid | Required invariant pointer for active/tombstone owner history |
| `deleted_at` | timestamptz nullable | Logical deletion |
| `created_at`, `updated_at` | timestamptz | Required |
| `version` | integer | Optimistic concurrency |

Constraints/indexes:
- global unique `slug`, with deleted rows retained;
- foreign key from `(id, owner_user_id)` to membership `(org_id, user_id)`, deferred until commit;
- commit-time invariant trigger requires one active Owner matching `owner_user_id` for non-deleted organizations;
- deleted organizations retain ownership/history but tenant resolver denies them.

### `memberships`

| Field | Type | Rules |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `org_id` | uuid | Required tenant owner; foreign key organization |
| `user_id` | uuid | Required; foreign key user |
| `role` | enum | `viewer`, `member`, `admin`, `owner` |
| `joined_at` | timestamptz | Required |
| `ended_at` | timestamptz nullable | Null means current membership |
| `end_reason` | enum nullable | `left`, `removed`, `organization_deleted`, `account_deleted` |
| `created_at`, `updated_at` | timestamptz | Required |
| `version` | integer | Optimistic concurrency |

Constraints/indexes:
- unique history identity as needed by `id`; partial unique `(org_id, user_id) WHERE ended_at IS NULL`;
- unique `(org_id, user_id)` support key for the deferred owner pointer if history is represented as one lifecycle row per relationship; rejoin reactivates the ended row and appends an event rather than inserting a duplicate;
- partial unique `(org_id) WHERE role='owner' AND ended_at IS NULL`;
- indexes `(org_id, role, ended_at, user_id)` and `(user_id, ended_at, org_id)`;
- check: `ended_at IS NULL` iff `end_reason IS NULL`;
- platform-admin membership rejection trigger is a defense-in-depth check.

Former-member semantics use an ended row. Rejoining through a later valid invitation reactivates that relationship with a new `joined_at`, clears end state, assigns the invitation role, and records an event; historical episodes remain reconstructable from identity events.

### `invitations`

| Field | Type | Rules |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `org_id` | uuid | Required tenant owner |
| `email_normalized` | text | Required target |
| `role` | enum | `viewer`, `member`, `admin` only |
| `status` | enum | `pending`, `accepted`, `expired`, `revoked` |
| `inviter_user_id` | uuid | Required; retained if inviter account later deleted |
| `accepted_user_id` | uuid nullable | Set on acceptance |
| `expires_at` | timestamptz | Exactly 7 days from current issue/resend |
| `accepted_at`, `revoked_at` | timestamptz nullable | Match terminal state |
| `delivery_state` | enum | `queued`, `sent`, `failed`; not an invitation status |
| `last_delivery_error_code` | text nullable | Stable/redacted, no provider body/token |
| `created_at`, `updated_at` | timestamptz | Required |
| `version` | integer | Optimistic concurrency |

Constraints/indexes:
- partial unique `(org_id, email_normalized) WHERE status='pending'`; before issuing a new invite, expired pending rows are materialized as expired in the same transaction;
- `(org_id, status, created_at, id)` for list pagination;
- `(org_id, email_normalized, status)` for duplicate/member checks;
- accepted/revoked timestamps agree with status through checks;
- effective expiry is `status='expired' OR (status='pending' AND expires_at <= now)` in domain/query logic; acceptance always checks wall time under lock.

### `one_time_tokens`

Shared persistence shape for verification and invitation token versions; not tenant-scoped for verification but invitation rows always carry `org_id`.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | uuid | Primary key; public token selector may include this non-secret ID |
| `purpose` | enum | `email_verification`, `invitation_acceptance` |
| `user_id` | uuid nullable | Required for verification |
| `invitation_id` | uuid nullable | Required for invitation |
| `org_id` | uuid nullable | Required for invitation and leads invitation indexes |
| `token_digest` | bytea | SHA-256 digest only; never returned/logged |
| `version` | integer | Increments on resend |
| `expires_at` | timestamptz | 24 hours verification; 7 days invitation |
| `consumed_at`, `revoked_at` | timestamptz nullable | Single-use state |
| `created_at` | timestamptz | Required |

Constraints/indexes:
- exactly one subject kind matches purpose;
- unique `(purpose, token_digest)`;
- `(org_id, invitation_id, version DESC)` for invitation lookup;
- `(user_id, purpose, version DESC)` for verification resend;
- only current, unexpired, unrevoked, unconsumed version can transition.

Raw token format: `<token-id>.<32-random-byte-base64url-secret>`. Lookup by ID, digest candidate secret, compare constant-time, then verify purpose/subject/version/state. Token IDs do not establish authorization.

### `sessions`

| Field | Type | Rules |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `session_token_digest` | bytea | Unique digest of opaque cookie token; raw value only in cookie |
| `user_id` | uuid | Required |
| `active_org_id` | uuid nullable | Null on sign-in; server-mutated only |
| `expires_at` | timestamptz | Short-lived value configured by typed auth config |
| `last_seen_at`, `created_at`, `updated_at` | timestamptz | Required |
| `revoked_at` | timestamptz nullable | Immediate invalidation |
| `version` | integer | Rotation/switch concurrency |

Constraints/indexes:
- unique `session_token_digest`;
- `(user_id, revoked_at, expires_at)` for revoke-all/account deletion;
- `(active_org_id, revoked_at)` for organization/membership invalidation;
- `active_org_id` is a convenience pointer, never enough to authorize; tenant binder verifies user membership and organization state each request.

### `login_throttles`

Global security state, not tenant-scoped.

| Field | Type | Rules |
| --- | --- | --- |
| `email_key` | bytea | Primary key; SHA-256 normalized email |
| `failed_count` | smallint | 0–5 |
| `window_started_at` | timestamptz | Start of current 15-minute failure window |
| `locked_until` | timestamptz nullable | Set after fifth consecutive failure |
| `updated_at` | timestamptz | Cleanup/index support |

Operations use an atomic upsert/row lock. Success deletes or resets the record. A periodic cleanup may remove old unlocked rows, but correctness never depends on cleanup.

### `identity_events`

Append-only audit-ready facts. This is tenant-scoped when `org_id` is non-null and globally user-scoped for account/verification facts.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `org_id` | uuid nullable | Required for organization/membership/invitation events |
| `actor_user_id` | uuid nullable | Null only for system expiry/delivery facts |
| `subject_user_id` | uuid nullable | Affected user where applicable |
| `event_type` | closed enum | See contracts/events.md |
| `object_type`, `object_id` | text + uuid | Referenced identity object |
| `payload` | jsonb | Redacted IDs/roles/status/reasons only |
| `occurred_at` | timestamptz | Required |
| `sequence` | bigint | Monotonic per organization/global partition as supplied by outbox foundation |

Constraints/indexes:
- immutable after insert (database permissions/trigger);
- `(org_id, sequence)` and `(subject_user_id, occurred_at, id)`;
- JSON payload schema is event-versioned and rejects password/token/session/email-secret fields.

### Foundation `outbox_messages` extension/use

Spec 002 reuses the outbox entity delivered by spec 001 rather than defining a second queue. Identity facts reference redacted event IDs. Message-delivery entries add an encrypted envelope:

- `ciphertext`, 12-byte `nonce`, 16-byte authentication tag, key version, purpose, created/available/attempt timestamps;
- authenticated data binds `(outbox_id, message_kind, recipient_hash, key_version)`;
- no raw token, password, or session value in headers, logs, telemetry, identity event payload, or ordinary outbox JSON;
- token-bearing ciphertext is purged after successful/terminal delivery according to a short operational retention; redacted delivery metadata may remain.

## Value objects

### `EmailAddress`
- trims outer whitespace and normalizes case for equality;
- validates practical email syntax and maximum 254 characters;
- never used as a log field; telemetry uses no email or a one-way correlation digest.

### `OrganizationSlug`
- 3–48 characters;
- lowercase ASCII letters, digits, hyphens;
- starts/ends alphanumeric;
- suggested from name by lowercase/transliteration, separator collapse, trim, length cap; user confirms and uniqueness is checked transactionally.

### `OrganizationRole`
Closed ordered values: `viewer < member < admin < owner`. Capability checks use named policies rather than numeric comparison where exclusions apply (for example platform inspect and Owner-only billing/delete).

### `InvitationStatus`
Closed values: pending, accepted, expired, revoked. Delivery state is deliberately separate.

### `OpaqueTokenDigest`
Contains purpose, token ID/version, digest bytes, and expiry metadata; equality is constant-time. Raw secret is a transient issuance value and cannot be serialized into DTO/event/log types.

### `SessionContext`
`(userId, activeOrganizationId | null, currentRole | null, platformInspect=false)`. `currentRole` is populated by server resolution for one request, not trusted from persisted/cookie client input.

## State transitions

### User account

```text
Unverified --valid verification token--> Verified
Unverified --logical delete-----------> Deleted
Verified   --logical delete-----------> Deleted
Deleted    --anything------------------> rejected
```

Reusing a consumed token when the account is already verified returns idempotent `already_verified`; expired/revoked tokens fail. Resend revokes outstanding versions and issues a fresh 24-hour token.

### Invitation

```text
Pending --accept before expiry/exact email--> Accepted
Pending --time observed past expiry---------> Expired
Pending --Owner/Admin revoke---------------> Revoked
Pending --Owner/Admin resend---------------> Pending (new token version/expiry)
Expired --Owner/Admin resend---------------> Pending (new token version/expiry)
Accepted/Revoked --resend/revoke/accept----> rejected
```

Delivery `queued -> sent | failed`; a failed delivery does not transition invitation status. Resend from a failed pending invitation returns it to queued delivery with a new token version.

### Membership

```text
Absent/Ended --organization create/invite accept--> Active(Viewer|Member|Admin|Owner*)
Active(non-Owner) --authorized role change--------> Active(non-Owner role)
Active(non-Owner) --leave/remove/account delete---> Ended
Active(Owner) --transfer ownership----------------> Active(Admin)
Active(target non-Owner) --receive transfer-------> Active(Owner)
Active(Owner) --leave/remove/general role change--> rejected
```

`Owner*` is only organization creation or ownership transfer, never invitation/general role change. Organization deletion makes all memberships ineffective immediately; history receives `organization_deleted` end reason in the deletion transaction or is interpreted through the deleted organization until batch update completes in that same transaction.

### Session active organization

```text
SignedOut --sign in--------------------------> SignedIn(active=null)
SignedIn(active=null|A) --switch to member B-> SignedIn(active=B)
SignedIn(active=A) --membership/org ends----> SignedIn(active=null) on next evaluation
SignedIn --sign out/account delete----------> Revoked
```

## Transaction boundaries

| Operation | Atomic records/effects |
| --- | --- |
| Register | user + password hash + verification token digest + encrypted message outbox + redacted event |
| Sign in failure/success | throttle update/reset; session starts only after successful verification |
| Create organization | organization + Owner membership + active session pointer + identity events |
| Invite | invitation + token digest + encrypted message outbox + event, regardless of later delivery outcome |
| Accept invitation | lock invitation/token; validate; create/reactivate membership; consume token; mark accepted; event |
| Resend/revoke | lock invitation; transition/invalidate token; optional new token/outbox; event |
| Role/remove/leave | lock organization/member; authorize current role; mutate membership/session pointers; event |
| Transfer ownership | serializable org lock; demote/promote/pointer update; deferred invariant check; event |
| Delete organization | lock org; verify typed slug confirmation; set deletion; end access; revoke pending invites/tokens; clear sessions; event |
| Delete account | lock user's active Owner organizations; reject or mark deleted; end memberships; revoke sessions/tokens; event |
| Grant platform admin | lock user/memberships/sessions; require zero active membership; set flag; clear active org |

## Authorization projections

- `CurrentMembershipProjection`: user, organization, role, organization deleted state; loaded at request evaluation.
- `OrganizationSwitcherItem`: organization ID, name, slug, current role; only caller's active memberships.
- `MemberListItem`: user ID, display name, normalized email, role, joined time; tenant scoped.
- `InvitationListItem`: invitation ID, email, role, effective status, age, delivery state; Admin/Owner or platform inspect only.
- `PlatformIdentityInspection`: organization profile plus separately paged member/invitation projections; no mutation methods.

## Migration and rollback

Migration is additive. It creates enums, tables, foreign keys, partial indexes, invariant triggers, and least-privilege grants. Rollback in development drops only 002 objects after confirming no later migration depends on them. Production rollback is application rollback plus forward corrective migration; identity/audit records are never destructively dropped. Trigger/index SQL not expressible by Prisma schema is committed in the numbered migration and covered by PostgreSQL integration tests.
