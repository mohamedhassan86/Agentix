# Feature Specification: Tenancy & Identity

**Feature Branch**: `002-tenancy-identity`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Build the foundational identity and multi-tenancy layer for a multi-tenant SaaS platform. First product feature. Actors: new visitor, registered user creating an organization, Owner/Admin inviting by email, invitee accepting, multi-org member switching, authenticated user under role enforcement, and a platform application administrator who belongs to no organization but can inspect any organization. Core: user accounts (email + password), organizations with unique slug, membership with exactly one Owner and roles Viewer < Member < Admin < Owner, invitations with expiring tokens, sessions that carry user + active organization + role, and fail-closed tenant isolation on every organization-scoped action. Email verification is modeled now; the create/join gate is deferred. Organization delete is logical, not physical."

## Clarifications

### Session 2026-09-12

- Q: When a person who belongs to more than one organization signs in, which organization should be active? → A: None until they pick in the switcher (sign-in succeeds with no active organization; they must choose before tenant data appears)
- Q: If someone who is not a member of an organization asks for that organization's data, should the product admit that the organization exists? → A: Not found for guessed ids; explicit no-access only if they used to be a member
- Q: After several wrong password attempts on sign-in, what should happen? → A: After 5 failed attempts, reject further tries for 15 minutes using the same generic sign-in error (for existing and unknown emails)
- Q: How long should an email verification link stay valid? → A: 24 hours
- Q: If the invitation message cannot be delivered, should the pending invitation still be created? → A: Yes — create pending; Admins can see it and resend

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register and sign in (Priority: P1)

A new visitor creates an account with email, display name, and password, then signs in and signs out. The account is the person's single global identity. It starts unverified. A verification message with a single-use, expiring link is issued so a later phase can require verification before create/join; this phase records and can complete verification but does not block the rest of the journeys on it.

**Why this priority**: Nothing else in the product can happen without a durable user identity and an authenticated session. This is the first screen of the golden path.

**Independent Test**: Register with a unique valid email and password, sign in with those credentials, observe an authenticated session, sign out, and confirm a second sign-in with the wrong password is rejected. Verification can be completed via the issued link and a reused link is handled safely.

**Acceptance Scenarios**:

1. **Given** a new visitor, **When** they register with a valid unique email, display name, and password meeting the password rules, **Then** an account is created in an unverified state, a verification message with an expiring single-use link is issued to that email, and they can sign in immediately.
2. **Given** a visitor, **When** they register with an email that already belongs to an account (comparison is case-insensitive), **Then** no second account is created and the visitor is told registration did not succeed, without revealing whether the email is already registered beyond a generic failure.
3. **Given** a registered user, **When** they sign in with the correct email and password, **Then** an authenticated session is established that carries their user identity and **no active organization** (even if they belong to one or more). Organization-scoped data is not shown until they select an organization from the switcher or create one.
4. **Given** a registered user, **When** they sign in with an incorrect password, **Then** access is denied with a generic authentication error (no indication whether the email exists).
5. **Given** five consecutive failed sign-in attempts for the same email (whether or not an account exists), **When** a sixth attempt is made within 15 minutes, **Then** it is rejected with the same generic authentication error as a wrong password; after 15 minutes, sign-in may be tried again.
6. **Given** an authenticated user, **When** they sign out, **Then** the session ends and subsequent organization-scoped actions are rejected until they sign in again.
7. **Given** an unverified account with a valid unused verification link, **When** the person opens that link, **Then** the account becomes verified and the link cannot be used to verify again.
8. **Given** an already-verified account, **When** the original verification link is opened again, **Then** the system does not error as a new verification; it reports that the account is already verified and does not change other account state.

---

### User Story 2 - Create an organization and become its Owner (Priority: P1)

A signed-in user creates a new organization by giving it a name. The system derives a unique slug (the person may edit it before confirming). The creator becomes the organization's only Owner, the new organization becomes their active organization, and their session now carries (user, organization, Owner).

A brand-new user can complete register → (optional verify) → own an organization in at most three screens. Creating an organization from the org switcher is the same capability for someone who already has an account.

**Why this priority**: Tenant boundary creation is the product's second step and the prerequisite for every later resource. Without it there is nowhere for projects, secrets, or runs to belong.

**Independent Test**: Sign in as a user with zero organizations, create one with a unique name/slug, and confirm the user is Owner, the org is active, and a second create with the same slug is rejected.

**Acceptance Scenarios**:

1. **Given** a signed-in user with no organizations, **When** they create an organization with a valid name and an unused slug, **Then** the organization is created, they become its sole Owner, it becomes their active organization, and subsequent views reflect only that organization's data.
2. **Given** a signed-in user who already belongs to one or more organizations, **When** they create another organization, **Then** a new isolated organization is created, they are its Owner, and it becomes their active organization (previous memberships remain intact).
3. **Given** a signed-in user, **When** they attempt to create an organization with a slug that is already taken (including a logically deleted organization's reserved slug), **Then** creation is rejected with a clear slug-collision error and no organization is created.
4. **Given** an unauthenticated visitor, **When** they attempt to create an organization, **Then** the action is rejected and they are asked to sign in.

---

### User Story 3 - Invite teammates and accept membership (Priority: P1)

An Owner or Admin invites a person by email into the active organization with a specific role of Admin, Member, or Viewer (never Owner). A pending invitation is created with a secure, expiring token and an invite message is issued. Admins and Owners see pending invitations with status. The invited person accepts: if they have an account, they join; if they do not, they register (email locked to the invited address) and then join. Acceptance assigns the invited role and marks the invitation accepted.

**Why this priority**: An organization of one cannot be the team product. Invitation is the only way a non-creator becomes a member, and it is the path that must not leak tenant membership across organizations.

**Independent Test**: As Owner, invite an email as Admin; observe pending status; accept as that email; confirm membership with Admin role and invitation status accepted. Repeat for expire, revoke, duplicate-pending, and already-a-member.

**Acceptance Scenarios**:

1. **Given** an Owner or Admin in an organization, **When** they invite an email as Admin, Member, or Viewer, **Then** a pending invitation is created, an invite message with a secure expiring link is issued, and the invitation appears in that organization's pending list with status "pending" and the assigned role.
2. **Given** a pending invitation to an email that already has an account, **When** that person accepts it while signed in as that email, **Then** they become a member of that organization with the invited role, the invitation becomes "accepted", and they may switch to that organization.
3. **Given** a pending invitation to an email with no account, **When** the person opens the invite and registers, **Then** the account is created for that exact email, they join the organization with the invited role, and the invitation becomes "accepted".
4. **Given** a Member or Viewer, **When** they attempt to invite anyone, **Then** the action is rejected with a clear permission error and no invitation is created.
5. **Given** a pending invitation, **When** an Owner or Admin revokes it before acceptance, **Then** its status becomes "revoked" and a later accept attempt is rejected as revoked.
6. **Given** a pending invitation older than 7 days, **When** someone tries to accept it, **Then** it is rejected as expired (status "expired") and an Owner or Admin must resend to issue a new token and a new 7-day window.
7. **Given** a pending invitation, **When** an Owner or Admin resends it, **Then** a new secure token and a fresh 7-day expiry replace the previous token, the invitation stays pending, and the previous token can no longer be accepted.
8. **Given** Admins/Owners viewing the organization, **When** they open the pending invitations list, **Then** they see each invitation's email, role, status (pending / accepted / expired / revoked), and age; Members and Viewers do not see the pending list.

---

### User Story 4 - Enforce roles and the single-Owner invariant (Priority: P2)

Every authenticated action inside an organization is allowed or denied by the actor's current role in that organization. Roles are strictly nested: Viewer ⊂ Member ⊂ Admin ⊂ Owner. An organization always has exactly one Owner. Admins cannot demote, remove, or replace the Owner. Ownership moves only by an explicit transfer from the current Owner to an existing member, which makes the former Owner an Admin.

**Why this priority**: Later features must not re-implement permission checks. If the matrix is incomplete or the Owner invariant can be broken, every downstream feature is unsafe.

**Independent Test**: Exercise the permission matrix in this spec against every in-scope action; attempt to remove/demote the Owner as Admin (rejected); transfer ownership (exactly one Owner afterwards, former Owner is Admin); attempt last-Owner leave and last-Owner account deletion (blocked).

**Acceptance Scenarios**:

1. **Given** a Member, **When** they attempt an Admin-only action (invite, change a role, remove a member, change organization settings), **Then** the action is rejected with a clear permission error and no state changes.
2. **Given** a Viewer, **When** they attempt any create, edit, invite, or configure action, **Then** the action is rejected with a clear permission error; they can still read organization profile, member list, and (once those features exist) projects, runs, dashboards, and cost/spend.
3. **Given** an Admin, **When** they attempt to remove the current Owner or change the Owner's role, **Then** the action is rejected — the organization retains exactly one Owner.
4. **Given** an Owner, **When** they transfer ownership to another existing member, **Then** that member becomes the sole Owner and the original Owner becomes Admin (never left with no role).
5. **Given** the sole Owner, **When** they attempt to leave the organization or delete their own account, **Then** the action is blocked and they are told they must transfer ownership first.
6. **Given** an Admin whose role is downgraded to Member while they have an in-flight Admin action, **When** that action is evaluated, **Then** it is rejected based on the role at evaluation time, not on a stale session snapshot.
7. **Given** two concurrent ownership-transfer attempts, **When** both complete, **Then** exactly one person is Owner and the other is Admin; the organization never has zero or two Owners.

---

### User Story 5 - Switch organization and keep tenants isolated (Priority: P2)

A person may belong to many organizations and holds a distinct role in each. They switch the active organization explicitly (org switcher). After a switch, every view and action uses only the newly selected organization's data and that person's role there. Knowing or guessing another organization's identifier, slug, or a future resource id never grants access. A platform application administrator belongs to no organization and may inspect any organization's identity surface without becoming a member and without gaining mutation rights.

**Why this priority**: Cross-tenant leakage is a Severity 1 failure for this product. Isolation and the switcher are the reason this spec exists before any other tenant data.

**Independent Test**: User A owns Org 1, User B owns Org 2; A cannot read or change Org 2 by id or slug. A user in both orgs switches and sees only the selected org. A platform administrator can inspect both and cannot invite, delete, or change roles.

**Acceptance Scenarios**:

1. **Given** a user who belongs to two organizations and has just signed in, **When** they have not yet selected an organization, **Then** no organization's profile, members, or invitations are shown; the org switcher lists both organizations (with the user's role in each) and they must pick one to continue.
2. **Given** a user who belongs to two organizations, **When** they switch the active organization, **Then** all subsequent views and actions reflect only the newly selected organization's data and that user's role in it.
3. **Given** any authenticated request for an organization-scoped resource, **When** the requesting user is not a member of that organization, has never been a member of it, and is not a platform administrator, **Then** the outcome is indistinguishable from requesting an organization that does not exist: no tenant data, no admission that the organization exists.
4. **Given** a former member of an organization (removed, left, or the organization was logically deleted), **When** they request that organization's data and they are not a platform administrator, **Then** they receive an explicit no-access denial and no tenant data.
5. **Given** a member of Org 1 who has never been a member of Org 2, **When** they present Org 2's identifier as if it were active, **Then** the outcome is indistinguishable from a non-existent organization; the client cannot override the active organization to one they do not belong to.
6. **Given** a platform application administrator (no organization memberships), **When** they inspect an organization, **Then** they can read that organization's profile, members, and invitations, and they still cannot invite, remove, change roles, rename, transfer, or delete.
7. **Given** a platform application administrator, **When** a regular member attempts to obtain the same cross-organization inspect privilege, **Then** access is denied.
8. **Given** a user whose membership in the active organization is removed, **When** they make a subsequent organization-scoped request, **Then** they receive an explicit no-access denial for that organization and must select another organization they still belong to (or create/join one).

---

### Edge Cases

- **Last Owner leaves or deletes their account**: blocked until they transfer ownership to another existing member. An organization cannot be left with zero Owners.
- **Last Owner tries to transfer to a non-member**: rejected; transfer target must already be a member of that organization.
- **Same email invited twice to the same organization while a prior invite is still pending**: rejected; the existing pending invitation can be resent instead. A new invite is allowed only when no pending invitation exists for that email and organization (expired, revoked, or accepted-and-later-left are not "pending").
- **Invitation message cannot be delivered**: the pending invitation is still created and listed; Owner/Admin resend issues a new token. Delivery failure does not roll back the invite and does not invent a fifth invitation status.
- **Invitee is already a member of that organization**: rejected with a clear already-a-member error; no new invitation is created and the existing role is unchanged.
- **Invite to an email the inviter themselves uses**: allowed only if they are not already a member (they are); therefore rejected as already a member.
- **Accept invite while signed in as a different email than the invitation**: rejected; the person must sign in (or register) as the invited email.
- **Invitation to a logically deleted organization**: cannot be created; a previously pending invite cannot be accepted.
- **Role-change race**: authorization is re-evaluated at action time against current membership and role. A downgrade invalidates in-flight privileged actions.
- **Concurrent role changes on the same member**: last authorized write wins; an attempt to assign Owner via role-change (rather than transfer) is always rejected; an attempt that would leave zero Owners is always rejected.
- **Organization slug collision on create or rename**: rejected; no partial create. Slugs of logically deleted organizations remain reserved so they cannot be hijacked.
- **Slug change by Owner**: allowed if the new slug is valid and unused; old slug does not remain as an alias in this phase.
- **Email verification link reused after already verified**: treated as a no-op success ("already verified"), not as a new verification and not as a token-replay that signs the person in as someone else.
- **Expired or revoked verification link**: rejected; a new verification message can be requested by the signed-in user.
- **Deleting an organization that still has members other than the Owner**: allowed only by the Owner after an explicit confirmation step. Deletion is logical (not physical): the organization is marked deleted, all memberships lose access immediately, pending invitations become revoked, and a tombstone remains so the slug stays reserved and history can be audited later. No other organization's data is affected.
- **Owner deletes organization they are not active in**: the action is scoped to the organization they are acting on (which they own); after logical delete, if it was their active organization, active organization is cleared.
- **User with zero organizations after register**: they see an empty-state that offers create-organization or accept-an-invite; they cannot access any tenant data.
- **Sign-in never restores a previous active organization**: even a user with many memberships starts the session with none selected and must pick from the switcher (or create) before tenant data appears. Accepting an invitation adds membership but does not by itself make that organization active.
- **Platform administrator with leftover memberships**: a platform administrator account MUST have zero organization memberships; granting the privilege is rejected while any membership exists, and inviting a platform administrator into an organization is rejected.
- **Case and whitespace in email**: emails are stored and matched case-insensitively and trimmed; `Alex@Org.com` and `alex@org.com` are the same person.
- **Password never recoverable**: passwords are never returned, displayed, or written to logs, messages, or error details.
- **Invite token leakage**: invitation and verification tokens are unguessable, single-purpose, and never written in full to logs or to any response other than the issued message itself.

## Requirements *(mandatory)*

### Functional Requirements

#### Identity and sessions

- **FR-001**: The system MUST allow a visitor to register a user account with a unique email, a display name, and a password. Email uniqueness is case-insensitive.
- **FR-002**: The system MUST require passwords of at least 8 characters. The password MUST never be stored in recoverable form, returned in any response, or written to logs, messages, or error details.
- **FR-003**: The system MUST authenticate registered users with email and password and MUST reject invalid credentials with a generic authentication error. After 5 consecutive failed sign-in attempts for the same email within 15 minutes, further attempts for that email MUST be rejected for 15 minutes using that same generic error, whether or not the email is registered. Successful sign-in MUST clear the failure count for that email.
- **FR-004**: The system MUST support sign-out, after which the session cannot be used to perform authenticated actions.
- **FR-005**: An authenticated session MUST carry: the user identity; the currently active organization (or an explicit empty value); and that user's role in the active organization (or an explicit empty value). Sign-in MUST start with an empty active organization even when the user has memberships; an organization becomes active only when the user explicitly selects one they belong to (org switcher) or creates one. The client MUST NOT be trusted to assert organization or role; the server resolves both.
- **FR-006**: A user account is a single global identity. A user MAY belong to zero, one, or many organizations, with a distinct role per organization.
- **FR-007**: Registration MUST create the account in an unverified state and MUST issue a verification message containing a secure, single-use link that expires 24 hours after issue. Completing verification with a valid unexpired unused link marks the account verified. Reuse of a consumed link on an already-verified account reports "already verified" without changing other state. An expired or revoked link MUST be rejected; a signed-in user MUST be able to request a new 24-hour link.
- **FR-008**: This phase MUST NOT block creating or joining an organization on unverified email. A later phase will enforce "verified before create/join"; the verified/unverified state and verification completion path MUST already exist so that phase can turn the gate on without a data model change.

#### Organization

- **FR-009**: A signed-in user who is not a platform administrator MUST be able to create an organization by supplying a name and a unique slug. If they omit the slug, the system MUST propose one derived from the name. The creator MUST become the organization's sole Owner and the organization MUST become their active organization.
- **FR-010**: An organization MUST have a display name and a globally unique slug used in URLs and as the human-facing identifier. Slugs MUST be 3–48 characters, lowercase ASCII letters, digits, and hyphens, must start and end with a letter or digit, and MUST be unique including among logically deleted organizations.
- **FR-011**: All resources created in later features (projects, repositories, secrets, runs, budgets) belong to exactly one organization. This spec MUST establish the rule that an organization-scoped action is denied unless the actor is a current member of that organization (or a platform administrator performing a read-only inspect). Identifier guessing MUST fail closed.
- **FR-012**: Only the Owner MAY rename the organization, change its slug, transfer ownership, or logically delete the organization.
- **FR-013**: Member, Viewer, Admin, and Owner MAY view the organization profile. In this feature, changing name or slug is Owner-only (FR-012). Admin management of organization-level settings (budgets, secrets, agent defaults) is reserved for later features and MUST appear as Admin = Y in those specs.
- **FR-014**: Logical delete MUST require an explicit Owner confirmation, MUST immediately revoke all memberships and pending invitations, MUST retain a tombstone (so the slug stays reserved and later audit is possible), and MUST NOT physically erase the organization record in this phase.
- **FR-015**: Transfer of ownership MUST be initiated by the current Owner, MUST target an existing member of the same organization, MUST make that member the sole Owner, and MUST assign Admin to the previous Owner in the same operation. The system MUST reject any path that would result in zero Owners or more than one Owner, including under concurrent requests.

#### Membership and roles

- **FR-016**: The system MUST support exactly four organization roles, each strictly more permissive than the last: Viewer, Member, Admin, Owner. A user has at most one role per organization.
- **FR-017**: An organization MUST have exactly one Owner at every moment. The Owner role cannot be assigned by invitation or by a role-change; it moves only via FR-015.
- **FR-018**: Viewer MUST have read-only access to everything in the organization that is visible to members (organization profile, member list, and — when those features exist — projects, runs, dashboards, and cost/spend) and MUST be denied every create, edit, invite, approve, configure, or delete action.
- **FR-019**: Member MUST have every Viewer permission, MUST be denied creating or editing projects (a reserved capability of Admin and Owner), MUST be denied organization settings, billing, and membership management, and MUST be allowed day-to-day workflow actions reserved for later features (trigger runs, comment/approve within their scope).
- **FR-020**: Admin MUST have every Member permission, MUST be able to invite and remove members, change members' roles except the Owner, manage organization-level settings reserved for later features (budgets, secrets, agent defaults), and create/edit projects. Admin MUST NOT demote, remove, or replace the Owner, MUST NOT rename or delete the organization, MUST NOT transfer ownership, and MUST NOT manage billing.
- **FR-021**: Owner MUST have every Admin permission plus rename, slug change, logical delete, ownership transfer, and billing (billing itself is a later feature; the permission is reserved).
- **FR-022**: Owner and Admin MAY remove a non-Owner member. The removed person immediately loses access to that organization. They cannot remove the Owner.
- **FR-023**: Any member except the sole Owner MAY leave the organization. Leaving removes only that membership; other organizations are unaffected. If the left organization was active, the session's active organization is cleared.
- **FR-024**: Role changes and membership checks MUST be evaluated at action time. A permission error MUST be an explicit denial (stable error meaning, human-readable message), never a silent no-op.
- **FR-025**: Every in-scope action in the permission matrix below MUST be enforced server-side. The matrix is the contract later features extend; they MUST NOT weaken a "no" cell.

#### Invitations

- **FR-026**: Owner and Admin MUST be able to invite a person by email to the active organization with role Admin, Member, or Viewer. Inviting as Owner MUST be rejected. A pending invitation MUST be created even if the invitation message cannot be delivered; Owner/Admin can resend.
- **FR-027**: An invitation MUST carry a secure, unguessable, expiring token, the target email, the organization, the assigned role, the inviter, timestamps, and a status of pending, accepted, expired, or revoked.
- **FR-028**: Invitations MUST expire 7 days after issue. Accepting after expiry MUST fail as expired. Resend (Owner/Admin) of a pending or expired invitation MUST issue a new token and a new 7-day window and MUST invalidate the previous token. Resend of accepted or revoked invitations MUST be rejected.
- **FR-029**: Owner and Admin MUST be able to revoke a pending invitation. Revoked invitations cannot be accepted. A new invitation to the same email MAY be created after revoke.
- **FR-030**: Accepting a pending, unexpired, unrevoked invitation MUST add the invited email's user as a member with the invited role and set status to accepted. If no account exists, acceptance MUST require registration of that exact email first, then add membership.
- **FR-031**: The system MUST reject a second pending invitation for the same email and organization. The system MUST reject an invitation to an email that is already a member of that organization.
- **FR-032**: Pending invitations (email, role, status, age) MUST be visible to Owner and Admin of that organization and MUST NOT be visible to Member or Viewer. Cross-organization invitation lists MUST NOT leak.

#### Tenant isolation and platform administrator

- **FR-033**: Every request that reads or writes organization-scoped data MUST resolve (user, organization, role) on the server and MUST fail closed (no payload from the foreign tenant) when the user is not a current member, except FR-035. If the user has never been a member of that organization, the denial MUST be indistinguishable from a non-existent organization. If the user was previously a member, the denial MUST be an explicit no-access message. Neither form MAY include tenant data.
- **FR-034**: The client MUST NOT supply an organization identifier to override the active organization when the session already implies it, except for the explicit switch-organization action, which MAY only target an organization the user currently belongs to.
- **FR-035**: A platform application administrator is a user account with a platform-level privilege, not an organization role. They MUST belong to zero organizations. They MAY read any organization's identity surface (profile, members, invitations) for inspection. They MUST NOT mutate tenant data (invite, revoke, resend, role-change, remove, leave, rename, transfer, delete, create organization on someone else's behalf). Granting this privilege MUST be out-of-band (not self-serve) and MUST be rejected while the account has any membership.
- **FR-036**: A user MUST be able to switch active organization among organizations they currently belong to. After a switch, all subsequent views and actions MUST use only the newly selected organization's data and the user's role there. Until a selection (or a create that becomes active), organization-scoped screens MUST NOT show tenant data.
- **FR-037**: Membership removal, role downgrade, organization logical delete, and invitation revoke MUST take effect on the next evaluated request (no residual privileged access from a stale session snapshot).

#### Account lifecycle

- **FR-038**: A user MAY delete their own account only when they are not the sole Owner of any organization. If they are, deletion is blocked until they transfer ownership (or logically delete those organizations). Account deletion is logical: the account cannot sign in, memberships end, pending invitations they issued remain with the organization (still revocable by remaining Admins/Owners).
- **FR-039**: Membership, role-change, invitation, ownership-transfer, organization-create, and organization-delete events MUST be recorded so a later audit viewer can display them. This spec does not include an audit UI.

#### Screens and empty/permission states

- **FR-040**: The product MUST present: a sign-up screen, a sign-in screen (no organization picker), an authenticated empty-state for users with zero organizations (create or accept invite), a post-sign-in choose-organization state for users who have memberships but no active organization (org switcher listing each organization with the user's role, plus create-organization), an org switcher available after a selection, a Members & roles view (member list, role counts, permission matrix, pending invitations for Admin/Owner), an invite-member dialog (email + role Admin/Member/Viewer), a create-organization dialog (name + slug), and organization settings that include name/slug for Owner and a confirmation step for logical delete and for ownership transfer.
- **FR-041**: Role-gated controls MUST be disabled with a reason, not silently hidden. Loading, empty, error, and permission-denied states MUST exist for the identity screens.
- **FR-042**: A brand-new user MUST be able to go from registration to owning an organization in at most three screens (register, optional verification, create organization). Combining register and first-organization on one screen is an allowed equivalent.

### Permission matrix (normative)

Legend: **Y** = allowed, **N** = denied, **—** = not applicable. "Reserved" rows are not built in this spec; they are binding on later features.

| Action | Owner | Admin | Member | Viewer | Platform admin | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Register / sign in / sign out | — | — | — | — | — | Any visitor / the account holder |
| Complete email verification | — | — | — | — | — | The account holder |
| Create organization | Y | Y | Y | Y | N | Any signed-in non-platform-admin user; creator becomes Owner of the new org |
| Switch active organization (own memberships) | Y | Y | Y | Y | N | Only orgs the user belongs to |
| Inspect any organization (read identity surface) | N | N | N | N | Y | Platform admin only |
| View organization profile | Y | Y | Y | Y | Y | |
| View member list | Y | Y | Y | Y | Y | |
| View pending invitations | Y | Y | N | N | Y | |
| View permission matrix | Y | Y | Y | Y | Y | |
| Invite member (Admin/Member/Viewer) | Y | Y | N | N | N | Never as Owner |
| Resend invitation | Y | Y | N | N | N | Pending or expired only |
| Revoke invitation | Y | Y | N | N | N | Pending only |
| Accept invitation | — | — | — | — | N | The invited email's user |
| Change member role (not Owner) | Y | Y | N | N | N | Cannot assign Owner |
| Remove member (not Owner) | Y | Y | N | N | N | |
| Leave organization | Y* | Y | Y | Y | — | \*Blocked if sole Owner |
| Transfer ownership | Y | N | N | N | N | Target must be an existing member |
| Rename organization / change slug | Y | N | N | N | N | |
| Logically delete organization | Y | N | N | N | N | Confirmation required |
| Delete own account | Y* | Y | Y | Y | Y | \*Blocked if sole Owner of any org |
| View dashboards, runs, spec artifacts (reserved) | Y | Y | Y | Y | N | Later feature |
| View cost / spend (reserved) | Y | Y | Y | Y | N | Later feature; Viewer  |
| View dashboards, runs, spec artifacts (reserved) | Y | Y | Y | Y | N | Later feature |
| View cost / spend (reserved) | Y | Y | Y | Y | N | Later feature; Viewer is read-only including cost |
| Start runs / simulations (reserved) | Y | Y | Y | N | N | Later feature |
| Comment / approve within workflow (reserved) | Y | Y | Y | N | N | Later feature; approval still only via verified source-host ingress |
| Create / edit projects & repo mapping (reserved) | Y | Y | N | N | N | Later feature |
| Configure agents & skills (reserved) | Y | Y | N | N | N | Later feature |
| Manage secrets / provider keys (reserved) | Y | Y | N | N | N | Later feature |
| Manage organization budgets (reserved) | Y | Y | N | N | N | Later feature |
| Manage billing (reserved) | Y | N | N | N | N | Later feature |
| Rotate organization data key (reserved) | Y | N | N | N | N | Later feature |

### Key Entities

- **User account**: A person. Key attributes: unique email, display name, password (non-recoverable), verified/unverified state, platform-administrator flag, logical-deleted state. Relationships: zero or more memberships, zero or more issued or received invitations. One global identity.
- **Organization**: A tenant (company or team). Key attributes: name, unique slug, logical-deleted state, timestamps. Relationships: exactly one Owner membership, zero or more other memberships, zero or more invitations. All future resources belong to exactly one organization.
- **Membership**: The association of one user to one organization with exactly one role (Viewer, Member, Admin, Owner). A user has at most one membership per organization. Removing it immediately ends access.
- **Invitation**: An offer for an email to join one organization with a specific non-Owner role. Key attributes: email, role, status (pending / accepted / expired / revoked), expiry, inviter, secure token. Visible to Owner/Admin of that organization.
- **Session context**: The resolved (user, active organization or empty, role or empty) attached to an authenticated session. Sign-in always starts empty. Active organization is only ever one of the user's current memberships, set by an explicit switch or by creating an organization (platform administrators have none and use an inspect path instead).
- **Identity event (audit-ready record)**: An append-only record of membership and organization lifecycle facts (created, invited, accepted, revoked, expired, role changed, ownership transferred, member removed, member left, organization logically deleted, account logically deleted). No viewer UI in this spec.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A brand-new user can go from registration to owning an organization in at most 3 screens and under 3 minutes on a typical connection, without contacting support.
- **SC-002**: 100% of organization-scoped actions reject cross-tenant access attempts and return zero tenant data from the foreign organization. A caller who has never been a member of Org B cannot distinguish Org B from a non-existent organization. A former member of Org B receives an explicit no-access denial. Verified by automated tests for every in-scope action, not by review alone.
- **SC-003**: The permission matrix (Owner / Admin / Member / Viewer / platform admin × every in-scope action) is fully enumerated in this spec and covered by automated tests: every "N" cell produces an explicit permission error; every "Y" cell succeeds for an otherwise valid request. No in-scope action remains ambiguous.
- **SC-004**: An organization never has zero Owners or more than one Owner, including under concurrent transfer, leave, role-change, and delete attempts. Verified by concurrent tests.
- **SC-005**: 100% of Member and Viewer attempts to invite, change roles, or remove members are denied with a visible permission error (not a silent no-op), measured in automated tests.
- **SC-006**: After an org switch, 100% of subsequent organization-scoped reads return only the newly selected organization's data (sampled across profile, members, and invitations). Immediately after sign-in and before any switch or create, 100% of organization-scoped reads return no tenant data.
- **SC-007**: Expired invitations (age > 7 days) fail accept in 100% of attempts; resend by Owner/Admin restores a new 7-day pending invitation.
- **SC-008**: Platform administrators can inspect any organization's identity surface and fail 100% of mutation attempts on tenant data.
- **SC-009**: After 5 consecutive failed sign-in attempts for an email, 100% of further attempts within 15 minutes fail with the same generic error used for a wrong password, including when the email is not registered.

## Assumptions

- Sequential spec number **002** matches the published roadmap (`tenancy-identity`). Spec **001** (solution foundation / host wiring) is the intended engineering predecessor and is not yet delivered; this spec does not depend on its user-facing behavior.
- The brief said both "a user can belong to zero, one, or many organizations" and "a user can only have one organization". The many-organization reading is adopted: it is required by the switcher journey, the two-organization acceptance scenario, and the design org switcher. Projects remaining one-org-scoped is unchanged and is out of scope here.
- Email verification is modeled (unverified default, message issued, accept, reuse) but **not** gated: unverified users may create and join organizations in this phase. A later phase turns the gate on.
- Verification and invitation messages are issued as product events; a real mailbox provider may be replaced by a captured-message test pathway in this phase, as long as the token, expiry, and accept behavior are real.
- Password reset, MFA, SSO, social login, and SCIM are out of scope.
- Display name is required at registration (matches the design sign-up screen).
- Invitation expiry is 7 days (matches the Members view copy "Expire after 7 days").
- Platform administrator is a rare, out-of-band privilege for operators of the deployment, not a fifth organization role, and is read-only across tenants. In this spec, inspect rights cover the identity surface only (profile, members, invitations). Later features MAY extend read-only inspect to their own data; they MUST NOT grant the platform administrator mutation rights.
- Logical delete of an organization is allowed even when other members exist, after Owner confirmation; there is no physical delete in this phase.
- Viewer can read cost/spend once that feature exists. That follows the product brief ("read-only access to everything… including cost/spend") and differs from the design mock, which withholds cost from Viewer. Plan-time Design Delta is expected.
- The design mock's invite dialog offers an Owner role and project-scoped access. This spec forbids inviting as Owner and defers project-scoped access to the projects feature. Plan-time Design Delta is expected.
- The design mock's sign-up form also collects organization name, data region, and seats. Region and seats are billing/residency and out of scope. Combining first-organization with registration on one screen is allowed (FR-042).
- Branding in the design mock says "SpecOps"; user-facing copy for this product uses **Agentix**.
- No organization identifier is taken from the client to bypass the active organization except the explicit switch action (FR-034).
- Sign-in does not restore last-used organization and does not include an organization picker (a Design Delta versus the mock sign-in form). Selection happens only via the org switcher or by creating an organization.
- Future features MUST reuse this membership and role model; they MUST NOT introduce a parallel permission system.

## Out of Scope

- Projects, repository mapping, secrets vault, LLM/agent configuration, metering, budgets, billing, subscription, and payment.
- SSO, social login, SAML, SCIM provisioning.
- Enforcing email verification before create/join (modeled now, gated later).
- Password reset / recovery, MFA enrollment, session-device management.
- Audit log viewer UI (events are recorded; the viewer is a later feature).
- Data-region selection, seat counts, plan picker on sign-up.
- Project-scoped access on invitations.
- Physical deletion of organizations or accounts.
- Any approval path for agent runs (approvals remain exclusively on the verified source-host ingress in later specs).
- Console screens other than auth, org switcher, members/invitations, and the identity portion of organization settings.

## Constitution Check

Re-read performed: `.specify/memory/constitution.md` v1.2.0 (2026-09-12) and all prior `specs/*/spec.md`, `plan.md`, `data-model.md`, `contracts/` — **no prior feature specs exist**. (v1.2.0 amended the client stack from Angular to Next.js; this spec names no client framework, so no other check line is affected — the client layer stays plan-time under Principle II.)

| Principle | Binding on this spec? | How |
| --- | --- | --- |
| I Spec-driven delivery | Yes | This is `specs/002-tenancy-identity/`. No implementation detail in this file. Clarify is expected after specify because this spec carries authorization and a membership state machine. |
| II Clean architecture | Plan-time | Layer layout is not specified here. |
| III Rich domain model | Yes (invariants) | Organization has exactly one Owner; invitation status is a closed set; illegal transitions are explicit denials, not no-ops. Aggregate shapes belong in `data-model.md`. |
| IV Thin controllers | Plan-time | |
| V Tenant isolation by construction | **Yes — this is the originating spec** | Fail-closed membership check on every organization-scoped action; no client-supplied org override; cross-tenant test per action (SC-002). Platform-admin read path is an explicit, tested exception, not a filter bypass. |
| VI Secrets ciphertext | Partial | No tenant secret vault here. Passwords, invite tokens, and verification tokens MUST never appear in logs or error bodies (FR-002, invite-token edge case). |
| VII Verified ingress is the only approval path | Yes (non-goal) | This spec MUST NOT introduce an approve action in the console. Reserved "comment/approve" in the matrix is workflow permission for later source-host commands, not a console approve button. |
| VIII `ISourceProvider` | No | |
| IX Hooks / metering | No | |
| X Test-gated DoD | Yes | Permission-matrix tests, concurrent Owner-invariant tests, and per-action cross-tenant tests are success criteria. |
| XI Design-guideline fidelity | Yes | Auth, org switcher, Members & roles, invite dialog, create-organization dialog, settings danger-zone confirmation. Deviations (no SSO/SCIM, no invite-as-Owner, Viewer sees cost later, Agentix naming) are listed in Assumptions for a Design Delta in `plan.md`. |

No constitution exception is requested. Isolation controls are not deferred.
 Delta in `plan.md`. |

No constitution exception is requested. Isolation controls are not deferred.
sted. Isolation controls are not deferred.
 Delta in `plan.md`. |

No constitution exception is requested. Isolation controls are not deferred.
