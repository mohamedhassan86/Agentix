import { describe, it, expect, beforeEach } from "vitest";
import { createRequestContext, type IdentityActor } from "@/application/shared/context/request-context";
import { createListMembersHandler } from "@/application/identity/handlers/list-members-handler";
import { createListInvitationsHandler } from "@/application/identity/handlers/list-invitations-handler";
import { createListMyOrganizationsHandler } from "@/application/identity/handlers/list-my-organizations-handler";
import { LIST_MEMBERS_TYPE } from "@/application/identity/queries/list-members";
import { LIST_INVITATIONS_TYPE } from "@/application/identity/queries/list-invitations";
import { LIST_MY_ORGANIZATIONS_TYPE } from "@/application/identity/queries/list-my-organizations";
import { clampPageLimit, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/application/identity/queries/page-limit";
import { UserAccount } from "@/domain/identity/entities/user-account";
import { Organization } from "@/domain/identity/entities/organization";
import { Membership } from "@/domain/identity/entities/membership";
import { Invitation } from "@/domain/identity/entities/invitation";
import { createIdentityHarness } from "../../../helpers/identity-harness";
import { UuidV7Generator } from "@/infrastructure/persistence/id-generator";

const ids = new UuidV7Generator();

function actor(partial: Partial<IdentityActor> & Pick<IdentityActor, "userId" | "activeOrgId" | "activeRole" | "emailNormalized">): IdentityActor {
  return {
    sessionId: ids.generate(),
    sessionTokenDigest: new Uint8Array(32),
    isPlatformAdmin: false,
    displayName: "Actor",
    ...partial,
  };
}

describe("identity pagination", () => {
  let harness: ReturnType<typeof createIdentityHarness>;
  const now = new Date("2026-09-13T12:00:00.000Z");

  beforeEach(() => {
    harness = createIdentityHarness();
  });

  it("clamps limit to default 25 and max 100", () => {
    expect(clampPageLimit(undefined)).toBe(DEFAULT_PAGE_LIMIT);
    expect(clampPageLimit(0)).toBe(1);
    expect(clampPageLimit(1000)).toBe(MAX_PAGE_LIMIT);
  });

  it("lists members with opaque cursor, stable order, and owner count 1", async () => {
    const ownerId = ids.generate();
    const orgId = ids.generate();
    const owner = UserAccount.register({
      id: ownerId,
      emailNormalized: "owner@example.test",
      displayName: "Owner",
      passwordHash: "hash",
      now,
    });
    const org = Organization.createNew({ id: orgId, name: "Alpha", slug: "alpha-org", ownerUserId: ownerId, now });
    await harness.store.createUser(owner);
    await harness.store.createOrg(org);
    await harness.store.createMembership(
      Membership.createActive({ id: ids.generate(), orgId, userId: ownerId, role: "owner", now }),
    );

    for (let i = 0; i < 30; i += 1) {
      const userId = ids.generate();
      await harness.store.createUser(
        UserAccount.register({
          id: userId,
          emailNormalized: `m${i}@example.test`,
          displayName: `Member ${i}`,
          passwordHash: "hash",
          now: new Date(now.getTime() + i),
        }),
      );
      await harness.store.createMembership(
        Membership.createActive({
          id: ids.generate(),
          orgId,
          userId,
          role: "member",
          now: new Date(now.getTime() + i),
        }),
      );
    }

    const handle = createListMembersHandler(harness.deps);
    const ctx = createRequestContext({
      actor: actor({ userId: ownerId, activeOrgId: orgId, activeRole: "owner", emailNormalized: "owner@example.test" }),
    });
    const page1 = await handle({ type: LIST_MEMBERS_TYPE, limit: 25 }, ctx);
    expect(page1.items).toHaveLength(25);
    expect(page1.nextCursor).toBeTruthy();
    expect(page1.roleCounts.owner).toBe(1);

    const page2 = await handle({ type: LIST_MEMBERS_TYPE, cursor: page1.nextCursor ?? undefined, limit: 25 }, ctx);
    expect(page2.items.length).toBeGreaterThan(0);
    const idsSeen = new Set([...page1.items, ...page2.items].map((m) => m.id));
    expect(idsSeen.size).toBe(page1.items.length + page2.items.length);
  });

  it("lists invitations with cursor default 25 max 100", async () => {
    const ownerId = ids.generate();
    const orgId = ids.generate();
    await harness.store.createUser(
      UserAccount.register({ id: ownerId, emailNormalized: "owner@example.test", displayName: "Owner", passwordHash: "hash", now }),
    );
    await harness.store.createOrg(Organization.createNew({ id: orgId, name: "Alpha", slug: "alpha-org", ownerUserId: ownerId, now }));
    await harness.store.createMembership(Membership.createActive({ id: ids.generate(), orgId, userId: ownerId, role: "owner", now }));

    for (let i = 0; i < 30; i += 1) {
      await harness.store.createInvitation(
        Invitation.issue({
          id: ids.generate(),
          orgId,
          emailNormalized: `invite${i}@example.test`,
          role: "member",
          inviterUserId: ownerId,
          expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
          now: new Date(now.getTime() + i),
        }),
      );
    }

    const handle = createListInvitationsHandler(harness.deps);
    const ctx = createRequestContext({
      actor: actor({ userId: ownerId, activeOrgId: orgId, activeRole: "owner", emailNormalized: "owner@example.test" }),
    });
    const oversized = await handle({ type: LIST_INVITATIONS_TYPE, limit: 500 }, ctx);
    expect(oversized.items.length).toBeLessThanOrEqual(MAX_PAGE_LIMIT);
    const page = await handle({ type: LIST_INVITATIONS_TYPE }, ctx);
    expect(page.items).toHaveLength(DEFAULT_PAGE_LIMIT);
    expect(page.nextCursor).toBeTruthy();
  });

  it("lists my organizations with cursor pagination", async () => {
    const userId = ids.generate();
    await harness.store.createUser(
      UserAccount.register({ id: userId, emailNormalized: "multi@example.test", displayName: "Multi", passwordHash: "hash", now }),
    );
    for (let i = 0; i < 3; i += 1) {
      const orgId = ids.generate();
      await harness.store.createOrg(
        Organization.createNew({
          id: orgId,
          name: `Org ${i}`,
          slug: `org-${i}`,
          ownerUserId: userId,
          now: new Date(now.getTime() + i),
        }),
      );
      await harness.store.createMembership(
        Membership.createActive({ id: ids.generate(), orgId, userId, role: "owner", now: new Date(now.getTime() + i) }),
      );
    }
    const handle = createListMyOrganizationsHandler(harness.deps);
    const ctx = createRequestContext({
      actor: actor({ userId, activeOrgId: null, activeRole: null, emailNormalized: "multi@example.test" }),
    });
    const page = await handle({ type: LIST_MY_ORGANIZATIONS_TYPE, limit: 2 }, ctx);
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeTruthy();
  });
});
