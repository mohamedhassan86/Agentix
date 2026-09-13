# Phase 0 Research: Tenancy & Identity

**Feature**: [002-tenancy-identity](./spec.md)  
**Date**: 2026-09-12

All technical-context questions are resolved below. Exact package patches are intentionally left to the implementation lockfile; choices and supported major lines are fixed here.

## R-001 — Delivery prerequisite

**Decision**: Treat `001-solution-foundation` as a hard implementation prerequisite. Complete this plan, but do not scaffold Next.js, the layer roots, generic dispatch, Problem Details, Prisma baseline, outbox, telemetry, design-token CSS, or test runners in spec 002.

**Rationale**: The constitution fixes build order and says spec 001 supplies the compiling host. Absorbing it would combine two vertical slices, exceed the task-phase limit, and hide foundation work in an identity PR.

**Alternatives considered**:
- Scaffold the missing foundation here — rejected as scope creep and a direct roadmap/order violation.
- Block planning entirely — rejected because a reviewed design can be ready before its prerequisite lands; only implementation depends on the host.

## R-002 — Authentication and session strategy

**Decision**: Use Auth.js 5 Credentials at the framework boundary with a database-backed session ID in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie. Keep registration, credential verification, throttling, session-context mutation, and authorization as Application use cases behind ports. Persist only `user_id`, optional `active_org_id`, expiry, and rotation/revocation metadata in the session; resolve the current role from membership on every organization-scoped request.

**Rationale**: Auth.js documents JWT and database strategies; a database session stores an opaque ID in the cookie and supports immediate revocation. That fits sign-out, account deletion, membership removal, logical organization deletion, and the requirement not to trust a stale role. The active organization is server-maintained while role is re-derived. Credentials merely forwards credentials to the application authentication service rather than owning password rules.

**Alternatives considered**:
- JWT-only session carrying role — rejected because role/membership changes would remain stale or require a blocklist/database lookup anyway.
- Custom cookie/session framework — rejected because Auth.js supplies reviewed cookie/CSRF/session boundary behavior and the constitution names it as the default.
- Put authorization callbacks and Prisma calls directly in Auth.js config — rejected by clean architecture and testability.

**Sources**:
- Auth.js session strategies: https://authjs.dev/concepts/session-strategies
- Auth.js Credentials provider: https://authjs.dev/getting-started/authentication/credentials
- Auth.js adapter contract: https://authjs.dev/reference/core/adapters

## R-003 — Password storage and sign-in throttling

**Decision**: Hash passwords with `argon2` using Argon2id and a per-password random salt encoded in the PHC hash. Start at OWASP's minimum `m=19456 KiB, t=2, p=1`, benchmark in the deployment target, and version parameters for future rehash. Apply an atomic database throttle keyed by SHA-256 of the normalized email: five consecutive failures in a 15-minute window sets `locked_until = now + 15 minutes`; success clears it. Unknown accounts execute verification against a fixed dummy Argon2id hash and update the same throttle shape. Return one `AUTHENTICATION_FAILED` Problem Details response for unknown account, bad password, and lock.

**Rationale**: Argon2id is memory-hard and OWASP's preferred password KDF. The current `argon2` package supports Node 22 and is MIT licensed. A database throttle works across server instances and handles known/unknown emails uniformly without Redis. Digest keys avoid retaining unknown email addresses in the throttle table. Atomic upsert prevents concurrent attempts bypassing the count.

**Alternatives considered**:
- bcrypt/scrypt/PBKDF2 — rejected because Argon2id is the recommended first choice and no FIPS requirement exists.
- In-memory counters — rejected because they reset and diverge across serverless instances.
- IP-only limiting — rejected because FR-003 explicitly scopes the threshold to email; generic edge/IP abuse protection may be additive later.

**Sources**:
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- `argon2` package/repository and MIT license: https://github.com/ranisalt/node-argon2

## R-004 — Tenant resolution and Prisma filtering

**Decision**: Define an `ITenantContext` in Application with closed modes: `UnscopedIdentity`, `Member(orgId, userId)`, and `PlatformInspect(userId)`. Middleware resolves authenticated user and session first; a tenant binder then validates the active membership and organization state before dispatch. Infrastructure creates short-lived Prisma extended clients through one registry of every tenant-scoped model. Member clients inject `org_id` into reads and writes; missing context throws before a query. Platform-inspection clients expose only three typed read repositories (organization profile, members, invitations). Raw SQL and a general unfiltered client are unavailable to App/Application.

Every write fetches the target through the scoped client and includes `org_id` in unique selectors where supported. A schema test compares Prisma metadata with the tenant-model registry, so adding a tenant model without registration fails CI.

**Rationale**: Prisma query extensions can bind independent clients to a filter and intercept `$allModels`/`$allOperations`, which supports the constitution's registry-driven convention. Typed repositories are still needed because bulk writes, nested writes, unique selectors, and relationships require operation-specific ownership checks; a query extension alone is not treated as a complete security boundary. Separating platform inspection prevents accidental mutation capability.

**Alternatives considered**:
- Per-handler predicates — rejected because omission is a Severity 1 failure mode.
- Trust `active_org_id` and role from the cookie — rejected because membership, role, and deletion must take effect on the next request.
- PostgreSQL RLS in this slice — rejected as a second tenancy mechanism not required by the constitution; it complicates pooled connections and Prisma migrations without replacing application authorization.
- One bypass flag on the normal client for platform admins — rejected because it makes mutation reachable through the bypass.

**Sources**:
- Prisma Client query extensions and isolation clients: https://www.prisma.io/docs/orm/prisma-client/client-extensions/query
- Prisma ORM/Client Apache-2.0 license: https://github.com/prisma/prisma

## R-005 — Exactly-one-Owner invariant and concurrency

**Decision**: Keep Owner as a membership role and also persist the current owner user identifier on the organization as an invariant pointer. Enforce:

1. unique active membership `(org_id, user_id)`;
2. a partial unique index allowing at most one active `role='owner'` membership per organization;
3. a deferrable database constraint trigger at transaction commit requiring each non-deleted organization to have exactly one active Owner matching `organizations.owner_user_id`;
4. ownership transfer in one serializable transaction that locks the organization row, checks the caller/target under tenant scope, demotes old Owner to Admin, promotes target, updates the owner pointer, and appends the identity event/outbox record;
5. retries for serialization conflicts, mapped to a stable conflict response when exhausted.

Role-change, remove, leave, account-delete, and organization-delete operations lock and validate the same organization/owner set. General role change can never assign or remove Owner.

**Rationale**: An aggregate protects normal code paths; database constraints protect races and future code. The partial unique index prevents two Owners, while a commit-time constraint closes the zero-Owner gap. Row locking serializes competing transfers and makes one final order explicit.

**Alternatives considered**:
- Application check only — rejected because two concurrent transfers can both pass a stale check.
- Partial unique index only — rejected because it enforces “at most one,” not “at least one.”
- Store Owner only on organization and omit Owner membership role — rejected because the spec makes Owner one of exactly four membership roles and requires role counts/matrix behavior.

## R-006 — Invitation and verification tokens

**Decision**: Generate 32 random bytes with Node `crypto.randomBytes`, encode base64url, and expose the raw value only in the issued URL. Persist a versioned SHA-256 digest, purpose, subject, issuance/expiry/consumed/revoked timestamps; compare digests in constant time. Resend atomically revokes the previous token version and creates a new one. Acceptance locks the invitation row and performs status transition plus membership creation in one transaction.

A durable message outbox record stores the token-bearing message body encrypted with AES-256-GCM under a server-only deployment delivery key; nonce/tag/ciphertext are separate, the payload is never logged or projected to API responses, and token-bearing ciphertext is purged after terminal dispatch. Identity/audit events never contain token values or digests. A captured-message adapter is the default local/test delivery path; SMTP/API providers are out of scope.

**Rationale**: Digest-at-rest makes the normal token table safe after database disclosure. Durable encrypted delivery preserves the foundation's transactional-outbox rule and the requirement that invitation state survive provider failure without persisting a plaintext bearer token. Node's standard crypto avoids a new dependency.

**Alternatives considered**:
- Store plaintext token in invitation/outbox — rejected as unnecessary bearer-token exposure.
- Send inline and roll back on failure — rejected by FR-026 and dual-write safety.
- Signed stateless token — rejected because single-use, resend invalidation, revoke, and invitation status already require server state.

## R-007 — Email delivery behavior

**Decision**: Application operations commit account/invitation state, token digest, redacted identity event, and encrypted message outbox in one transaction. The worker dispatches to a `MessageDeliveryPort`. Local and integration environments use a database-backed captured-message adapter visible only through test helpers, never a production API. Delivery failure records attempt metadata and leaves the invitation pending; resend rotates the token and creates a fresh delivery item.

**Rationale**: This proves real token/expiry/acceptance behavior without network credentials or paid services and preserves pending invitations on delivery failure.

**Alternatives considered**:
- Add an email SaaS SDK — rejected because no provider is required by user value and licenses/credentials would add avoidable scope.
- Return tokens in API responses in development — rejected because the spec permits them only in the issued message.

## R-008 — API and contract generation

**Decision**: Application request/response DTO schemas are Zod 4 definitions. A registry using `@asteasolutions/zod-to-openapi` 8 generates OpenAPI 3.1 from the same schemas and operation metadata; CI regenerates and diffs the committed document. Next.js route handlers parse once and dispatch once. Every error uses RFC 9457 Problem Details with a stable `code`; every response carries `X-Correlation-Id`.

Member-scoped routes operate on `/api/v1/organization/...` and resolve the active organization from session. The sole member-facing organization target input is `POST /api/v1/session/active-organization`. Platform inspection uses `/api/v1/platform/organizations/{organizationId}/...` and a distinct read-only policy. Inactive-owner administration therefore requires switch-then-mutate.

**Rationale**: This preserves code-first contract generation, same-origin typed clients, thin routes, and FR-034. Zod-to-OpenAPI supports Zod 4 and OpenAPI 3.x and is MIT licensed.

**Alternatives considered**:
- Hand-maintained OpenAPI only — rejected because it can drift from validation types.
- API-first generated server framework — rejected because the constitution fixes Next.js routes and explicit Application DTOs.
- Organization IDs on normal member route bodies — rejected because the active session already implies tenancy.

**Sources**:
- Zod-to-OpenAPI project and MIT license: https://github.com/asteasolutions/zod-to-openapi
- RFC 9457: https://www.rfc-editor.org/rfc/rfc9457.html

## R-009 — Invitation status and membership history

**Decision**: Preserve historical membership rows using `ended_at`/`end_reason`; only rows with `ended_at IS NULL` are active. The former-member response is chosen only after a scoped access resolver finds history for the same user and requested target; callers with no history receive the same `ORGANIZATION_NOT_FOUND` shape as a nonexistent target. Invitation expiry is materialized atomically when an expired invitation is read for acceptance/list/resend, while effective status is also derived from `expires_at` so stale `pending` storage never permits acceptance.

**Rationale**: The product must distinguish former from never-members without leaking tenant details. History also supports future audit display. Effective expiry avoids relying on a scheduler.

**Alternatives considered**:
- Hard-delete memberships — rejected because former-member semantics become impossible.
- Scheduled expiry only — rejected because worker delay could permit an expired token.
- Return 403 to all nonmembers — rejected because it confirms guessed organizations exist.

## R-010 — Organization deletion and slug reservation

**Decision**: Logical deletion sets `deleted_at`, records the event, revokes active access by making organization state part of every membership resolution, revokes pending invitations, clears affected active session organization pointers, and retains organization/membership/invitation history. The slug remains under a global unique constraint. The Owner must type the current slug as confirmation. The Owner first switches to the organization if it is not active, then deletes through the active-organization endpoint.

**Rationale**: A retained row naturally reserves the slug and supports audit. Checking organization state in tenant resolution revokes all memberships immediately without destructively rewriting history.

**Alternatives considered**:
- Physical cascade delete — expressly out of scope and loses history/slug reservation.
- Rename slug to a tombstone — rejected because it permits hijacking the original URL identifier.
- Pass arbitrary organization ID to delete — rejected by FR-034; switch-then-delete is explicit and auditable.

## R-011 — UI composition and accessibility

**Decision**: Build server-rendered route shells with focused client components for forms, switcher, menus, dialogs, and toasts. Reuse the canonical tokens/component classes from `Public/Desgin/index.html`; use Lucide icons and Inter. Render role-gated controls disabled with an adjacent reason. Implement focus trap, Escape close, trigger-focus restore, tab/menu semantics, `aria-live` feedback, inline errors, visible focus rings, and reduced-motion behavior. Do not use literal component hex colors.

**Rationale**: This follows Principle XI and keeps JavaScript/session payloads small while supporting interactive identity flows.

**Alternatives considered**:
- Copy the single-file mock JavaScript — rejected because it is a visual reference, not production architecture or accessible state management.
- Hide forbidden controls — rejected by FR-041.
- Introduce a component framework — rejected because existing components/tokens are sufficient and another dependency needs no justification.

## R-012 — Pagination and platform inspection

**Decision**: Member lists, invitation lists, organization switcher memberships, and platform lists use opaque cursor pagination, default 25/max 100, stable order `(created_at, id)`. Platform admins may query an organization by exact ID or slug through the dedicated inspect screen, then read profile/members/invitations; all mutations and organization creation are rejected in Application policy. Grant/revoke of platform privilege is an out-of-band infrastructure operation with a transaction that requires zero active memberships and clears active organization sessions.

**Rationale**: Pagination follows global API rules and scale targets. A separate platform policy proves that platform privilege is not a fifth role and cannot accidentally inherit Owner operations.

**Alternatives considered**:
- Reuse Owner role — rejected by FR-035.
- Reuse normal tenant context with synthetic membership — rejected because platform administrators must have zero memberships.
- Self-serve platform admin endpoint — expressly forbidden.

## R-013 — Prerequisite status update (2026-09-13, plan re-run)

**Decision**: The R-001 prerequisite is now **satisfied**: `001-solution-foundation` is delivered. All 46 tasks in `specs/001-solution-foundation/tasks.md` are checked complete; the implementation checklist records the standard gates green (lint, 112 tests, production build, license scan of 994 packages, zero dependency-cruiser violations, validated additive migration `001_solution_foundation`). The concrete PostgreSQL adapter choice 001 made (`@prisma/adapter-pg` + native `pg`, Prisma 7.10.x) is adopted in this plan's Technical Context.

**Rationale**: The 2026-09-12 plan recorded 001 as "not yet planned or delivered" and set a stop condition before task generation/implementation. A 2026-09-13 re-run of `/speckit-plan` verified the delivered state, so the gate line in `plan.md` moves from ⚠️ PREREQUISITE to ✅ PASS and the stop condition is lifted.

**Alternatives considered**:
- Keep the stop condition — rejected; it is factually stale and would block `/speckit-tasks` against a delivered foundation.
- Absorb any remaining foundation work into 002 — rejected as before (R-001); 002 still must not re-scaffold foundation concerns.
