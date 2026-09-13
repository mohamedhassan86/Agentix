# Implementation checklist: Tenancy & Identity (002)

**Feature**: [spec.md](../spec.md)  
**Date**: 2026-09-13  
**Branch**: `arena/01a09a8f-agentix`

## Gates (T060)

Recorded after Phase 8 polish:

| Gate | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | pass (zero warnings) |
| Tests | `npm test` | pass (72 files, 249 tests) |
| Build | `npm run build` | pass (Next.js 16.3.5) |
| License | `npm run license:check` | pass (1009 packages) |
| Architecture | `npm run architecture:check` | pass (zero violations) |
| OpenAPI | `npm run openapi:check` | pass (34 operations) |
| Test policy | `npm run test:policy` | pass (no .skip/.only/todo/placeholder) |
| E2E identity | `npm run test:e2e -- --grep "identity"` | blocked in this environment: Playwright Chromium is not cached and `npx playwright install chromium` failed with `ECONNRESET` to cdn.playwright.dev. Coverage is represented by `tests/unit/ui/identity/accessibility.test.tsx`, `ui-states.test.tsx`, and `tests/e2e/identity.spec.ts` (golden path + accessibility + permission states). |
| Whitespace | `git diff --check` | pass |

No `.env`, captured messages, dumps, plaintext tokens, or credentials in the working tree.

## Success criteria evidence

| Criterion | Evidence |
| --- | --- |
| SC-001 3-screen register→own | `tests/e2e/identity.spec.ts`, `src/app/(auth)`, `src/app/(identity)/organizations` |
| SC-002 cross-tenant zero payload | `tests/integration/tenancy/isolation-per-operation.test.ts` |
| SC-003 permission matrix | `tests/integration/api/identity/permission-matrix.test.ts` |
| SC-004 exactly one Owner | `tests/integration/tenancy/concurrent-owner.test.ts` |
| SC-005 Member/Viewer invite denied | `tests/integration/api/identity/permission-matrix.test.ts`, `tests/unit/ui/identity/member-actions.test.tsx` |
| SC-006 switch isolation | `tests/integration/api/identity/session-switch.test.ts` |
| SC-007 invitation expiry/resend | `tests/integration/api/identity/invitations.test.ts` |
| SC-008 platform admin read-only | `tests/integration/api/identity/platform-inspection.test.ts` |
| SC-009 throttle 5/15 min | `tests/integration/api/identity/sign-in.test.ts` |

## Design deltas implemented

- Agentix branding (not SpecOps)
- No region/seats on sign-up
- No sign-in organization picker; choose-org after memberships exist
- No Owner invite option; no project-access field
- Viewer cost UI deferred
- No SSO/social login controls
