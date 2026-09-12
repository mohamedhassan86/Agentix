# Business Rules: GitHub Approval Surface

**Status:** product requirements awaiting a spec — *not* governance.
**Consumed by:** `specs/009-webhook-ingress/spec.md` and `specs/010-github-provider/spec.md`.
**Why this file exists:** these rules were removed from
[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) at v1.1.0 because a
constitution governs how the software is engineered, not what it promises users (Principle I, scope
boundary). Nothing here is binding until it appears as a numbered functional requirement in a spec;
the durable architectural part — no approval path other than the verified ingress — stays in
Principle VII.

---

## 1. Run entry points

| Trigger | Condition | Effect |
| --- | --- | --- |
| Issue labelled `sdlc` | label added by an org member or above | create a run at phase `specify`, link issue, comment acknowledgement |
| `/specify <intent>` comment | on an issue or PR, author is an accepted org member | create a run with the given intent text |
| `/retry` | run in a failed or blocked state, author has run access | re-queue the failed phase only |
| Manual "start run" in console | allowed: this creates a run, it does not approve one | same pipeline, marked `origin = console` |

## 2. Command surface (comments on the issue or the draft PR)

| Command | Authorised role | State-machine effect | Reply behaviour |
| --- | --- | --- | --- |
| `/approve` | owner, admin | run `AwaitingReview` → `Approved`; PR marked ready | "approved — merge this PR to deliver" |
| `/revise <feedback>` | owner, admin, member | run → `Revising`; feedback becomes a Judge-style input to the producing phase | acknowledgement with the phase being re-run |
| `/reject` | owner, admin | run → `Rejected`; PR closed with reason | reason echoed, run retained for audit |
| `/answer <text>` | owner, admin, member, viewer (read of the question; answer needs member+) | answers an open `clarify` question, resumes the paused phase | records which question was answered |
| `/status` | any org member (viewer allowed) | none (read-only) | current phase, judge score, cost so far, next required action |
| `/cost` | any org member (viewer allowed) | none (read-only) | spend for the run vs project and org budget remaining |
| `/retry` | owner, admin, member | re-queues the failed phase | new attempt id |

Unknown commands, or commands from unauthorised authors, receive one short usage reply and an audit
entry; repeated failures from the same actor are rate-limited, not silently dropped.

## 3. Delivery semantics

- The bot commits Spec Kit artifacts to the spec branch (`docs(NNN): …`), opens a **draft** PR, and
  requests review in a PR comment.
- Merging the PR is delivery: run → `Delivered`, and only on the merge event.
- `/approve` never merges; merging never implies review passed by a human of sufficient role (it does
  imply it, because the merge button is protected — see §5).
- Closing the PR without merging → run stays `Rejected`/`Closed`, artifacts remain on the branch.

## 4. Inbound verification (values owned here, algorithm owned by Principle VI)

- Per-connection HTTPS endpoint whose path carries a high-entropy connection token; no shared URL.
- `HMAC-SHA256` over the raw request body, timestamp header compared within a **300 s** window.
- Constant-time signature comparison; unknown connection, stale timestamp, or mismatch → `401` with
  an audit record and no distinguishing detail.
- De-duplication on `(connection_id, delivery_id)` with a unique index; a duplicate delivery returns
  the prior outcome as a no-op. Delivery ids stay unique per connection forever.
- The handler enqueues work and acknowledges within 5 s; phase execution never runs inline.

## 5. Repository-side protections

- Branch protection on `main`: required review, no force push, no direct push by bots.
- The bot identity may push to `NNN-*` branches only.
- The bot MUST NOT approve or merge its own PR (mirror of the developer rule in Principle VII's
  governance counterpart, Delivery Workflow).

## 6. Simulator parity (console)

- The simulator constructs a provider-shaped payload and POSTs it to §4's endpoint with a valid
  signature — same handler, same pipeline, same audit trail.
- There is **no approve button** in the console, and no console affordance that advances approval.
  The dashboard states it verbatim: *"There is intentionally no approve button."*
- Simulated events are tagged `origin = simulated` in the timeline and excluded from billing.

## 7. Out of scope for v1

Review-thread (inline diff) comments as approval signals; `@agentix` mentions; multi-PR runs per
issue; Jira/Linear intake; Slack/Teams approvals; signed webhook rotation self-service UI (rotation
is an org-admin action in the vault until spec `012`).

## 8. Open questions for `/speckit-clarify` on 009/010

1. Does `/revise` on an already-`Approved` run revoke the approval, or queue a post-approval revision?
2. Are `/status` and `/cost` replies visible to viewers (no write access) or suppressed to authors?
3. Multiple concurrent runs on one issue: allowed, or one active run per issue with a conflict reply?
4. Should `/reject` require a non-empty reason (yes) and should it close the PR automatically?
5. Do runs on forks / read-only mirrors start at all?
6. Azure DevOps parity: which commands land in the stub (spec `012`) before the contract is called
   provider-neutral in practice?
