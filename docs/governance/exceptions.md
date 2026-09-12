# Governance Exception Register

A standing exception is the only sanctioned way to knowingly depart from a principle in
[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md). Exceptions are granted
per PR by an organisation owner/admin, MUST carry an expiry date and a linked follow-up spec, and
MUST NOT be used to defer a security or tenant-isolation control.

| ID | Date | Spec / PR | Principle | Departure | Justification | Follow-up | Expires | Approved by |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EX-000 | 2026-09-12 | — | — | _No active exceptions. Add rows above; never delete history._ | — | — | — | — |

## Rules

1. One row per exception. An expired exception is either implemented or escalated to a
   `/speckit-constitution` amendment — never silently renewed.
2. Principles V (tenant isolation), VI (secrets), and VII (GitHub-only approval) accept **no**
   exceptions that weaken the control itself; an exception may only delay non-critical scope, and the
   compensating test must already exist.
3. A PR that needs an exception states it under "Constitution Check" in `plan.md` with the same ID.
4. At each constitution amendment, open exceptions are re-reviewed; a MINOR/MAJOR bump that removes
   the need for one must close it here in the same commit.
