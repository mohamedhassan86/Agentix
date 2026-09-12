# Quickstart Validation: Tenancy & Identity

**Feature**: [002-tenancy-identity](./spec.md)  
**Contract**: [contracts/openapi.yaml](./contracts/openapi.yaml)  
**Model**: [data-model.md](./data-model.md)

This is the reviewer-run validation guide for the completed feature. It intentionally contains no implementation code. Commands assume spec 001 has delivered the standard repository scripts; if it has not, stop rather than creating substitute scripts in spec 002.

## 1. Prerequisites

- Node.js 22 LTS and npm
- Docker with enough resources for PostgreSQL 16 Testcontainers, or the foundation-supported isolated PostgreSQL branch database
- Spec 001 merged/delivered: Next.js host, worker, Prisma baseline, outbox, typed config, design tokens, and standard test scripts
- No production mailbox, GitHub token, KMS, or paid provider credential
- Server-only test values for the Auth.js secret and message-delivery AES key; never commit them

Create local values using the repository's documented example mechanism. The implementation must fail fast when required server config is absent and must not print key values.

## 2. Install and inspect

```bash
npm ci
npm run license:check
npm run prisma:validate
npm run openapi:check
```

Expected:
- dependency licenses are limited to the constitution allow-list;
- Prisma schema and migration `002_tenancy_identity` validate;
- generated OpenAPI 3.1 matches `specs/002-tenancy-identity/contracts/openapi.yaml` semantically and has no password/hash/token/session response fields;
- no source imports violate Domain → Application → Infrastructure/App direction.

## 3. Start the local stack

Use spec 001's standard database bootstrap, then:

```bash
npx prisma migrate deploy
npm run dev -- --hostname 0.0.0.0
```

In a second process:

```bash
npm run worker
```

Expected:
- app and worker start without external network access;
- captured-message delivery adapter is selected only in local/test mode;
- browser uses same-origin `/api/v1` URLs;
- no secret/token appears in startup logs.

## 4. Golden path

Run the Playwright identity project or perform the equivalent through the UI:

```bash
npm run test:e2e -- --grep "identity golden path"
```

Expected sequence:

1. Register `owner-a@example.test` with display name and a valid password.
2. Observe unverified account state and a captured verification message; the registration API body contains no token.
3. Open the captured verification link once: status becomes `verified`; open it again: `already_verified` with no sign-in side effect.
4. Sign in: session has `activeOrganizationId=null` and no tenant profile/members/invitations are rendered.
5. Create “Alpha Org” / `alpha-org`: creator becomes the only Owner and Alpha becomes active.
6. Open Members & roles; Owner count is exactly one and permission matrix is visible.
7. Invite `admin@example.test` as Admin; pending invite survives a simulated delivery failure and appears with `failed` delivery state without exposing the token.
8. Resend; prior link fails, fresh link works. Register/sign in as the exact invite email and accept. Acceptance does not automatically switch active organization.
9. Admin explicitly switches to Alpha and can invite/change/remove a non-Owner, but cannot rename/delete/transfer or modify Owner.
10. Create/join “Beta Org,” sign in again, and verify no organization is active until explicitly selected.
11. Switch Alpha → Beta; every subsequent profile/member/invitation view contains only Beta data.
12. Transfer Alpha ownership to the Admin; original Owner becomes Admin and exactly one Owner remains.
13. New Owner types the slug confirmation and logically deletes Alpha; slug cannot be reused and all Alpha access/invites end immediately.

The browser flow uses Agentix branding, canonical tokens/components, no sign-in organization picker, no Owner invitation option, no project-access invitation field, and no active SSO control.

## 5. Automated rule suites

Run targeted suites before the full gate:

```bash
npm test -- --run tests/unit/domain/identity
npm test -- --run tests/unit/application/identity
npm test -- --run tests/integration/persistence/identity
npm test -- --run tests/integration/api/identity
npm test -- --run tests/integration/tenancy
npm test -- --run tests/contract/identity
npm test -- --run tests/unit/ui/identity
```

Expected named coverage:

### Identity and throttle
- unique normalized email and generic duplicate registration failure;
- Argon2id hash never equals/reveals password and uses approved parameters;
- unknown and known email return the same authentication Problem Details shape;
- fifth consecutive failure locks for 15 minutes, sixth fails generically, success after expiry clears count;
- sign-out/revoked/deleted sessions fail immediately;
- sign-in always starts with no active organization;
- verification valid/expired/revoked/reused/resend paths.

### Organization and membership
- create assigns one Owner and active organization atomically;
- slug syntax/global uniqueness/deleted-slug reservation;
- all role-matrix Y/N cells for every in-scope action;
- Owner cannot leave, be removed, or change through general role update;
- target of transfer must be an active member;
- two concurrent transfers, leave/delete/role-change races always commit with exactly one Owner;
- role downgrade/removal is effective on the next request despite session state;
- account deletion blocked by owned organization and succeeds after transfer/delete.

### Invitations
- Admin/Owner issue Admin/Member/Viewer only;
- duplicate pending and existing member rejected;
- delivery failure leaves pending;
- expiry after seven days, resend token invalidation/new expiry, revoke, wrong-email acceptance, exact-email registration acceptance;
- accepted/revoked resend rejected;
- accept/revoke/expire races have one terminal result;
- platform administrator cannot be invited.

### Tenant isolation
For **every organization-scoped operation** in OpenAPI, execute the same call as:

1. a current member with required role — expected Y result;
2. each insufficient role — explicit stable permission result;
3. a never-member using another tenant's resource/organization identifier — same 404 code/title/detail/body length class as nonexistent, with zero foreign fields;
4. a former member — explicit no-access with zero tenant fields;
5. no active organization — zero tenant fields;
6. platform administrator through normal member route — denied;
7. platform administrator through inspect GET — allowed; through every mutation — denied.

Also assert foreign identifiers/email/name/slug do not appear in response body, structured log sink, trace attributes, or identity events.

### Token/secret redaction
Search captured responses, OpenAPI, logs, traces, identity events, ordinary outbox metadata, thrown errors, and snapshots for seeded password, session token, verification token, invitation token, token digest, and delivery key. All counts must be zero. Only the protected captured-message test helper may reveal the one issued action URL.

## 6. UI and accessibility review

```bash
npm test -- --run tests/unit/ui/identity
npm run test:e2e -- --grep "identity accessibility|identity permission states"
```

Verify:
- loading, empty, error, permission-denied, no-active-organization, expired/revoked, delivery-failed, unverified, and already-verified states;
- disabled controls retain a visible reason and are not silently hidden;
- full keyboard operation for auth tabs, organization switcher, invite/create/transfer/delete dialogs;
- dialogs trap focus, Escape closes, and trigger focus is restored;
- every input has label and inline error association; status has text, not color alone;
- visible `:focus-visible`, body text contrast ≥ 4.5:1, icons/large text ≥ 3:1;
- reduced-motion preference removes transitions/animations;
- no literal component color replaces a canonical CSS token.

## 7. Performance checks

Seed 10,000 memberships/invitations for one tenant and a second foreign tenant using test factories, then run the foundation's endpoint benchmark:

```bash
npm run test:performance -- --scenario tenancy-identity-10k
```

Expected:
- non-LLM profile/member/invitation reads p95 < 300 ms;
- switch server operation p95 < 300 ms;
- query plans use indexes leading with `org_id`;
- no query is executed by a tenant-scoped repository when tenant context is absent;
- password KDF latency is reported separately and never weakened to meet the read budget.

## 8. Full definition-of-done gate

```bash
npm run lint
npm test
npm run build
npm run license:check
```

All commands must pass with no suppressed warnings or skipped tests. Domain rule-bearing code must meet ≥90% line coverage and Application handlers ≥80%, while named isolation/invariant/redaction tests remain mandatory regardless of percentage.

Finally inspect:

```bash
git diff --check
git status --short
```

Expected: only intentional feature files; no `.env`, captured messages, database dump, generated build output, plaintext token, or credential. A reviewer other than the author records successful quickstart execution before the feature is marked done.
