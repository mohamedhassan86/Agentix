import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createListMembersHandler } from "@/application/identity/handlers/list-members-handler";
import { LIST_MEMBERS_TYPE } from "@/application/identity/queries/list-members";
import { createRequestContext } from "@/application/shared/context/request-context";
import { UserAccount } from "@/domain/identity/entities/user-account";
import { Organization } from "@/domain/identity/entities/organization";
import { Membership } from "@/domain/identity/entities/membership";
import { createIdentityHarness } from "../../helpers/identity-harness";
import { UuidV7Generator } from "@/infrastructure/persistence/id-generator";
import { MAX_PAGE_LIMIT } from "@/application/identity/queries/page-limit";

const ids = new UuidV7Generator();

describe("tenancy-identity-10k read performance", () => {
  it("profile/member/invitation reads stay under p95 300ms for a 10k membership tenant", async () => {
    const harness = createIdentityHarness();
    const now = new Date("2026-09-13T12:00:00.000Z");
    const ownerId = ids.generate();
    const orgId = ids.generate();
    await harness.store.createUser(
      UserAccount.register({ id: ownerId, emailNormalized: "owner@example.test", displayName: "Owner", passwordHash: "hash", now }),
    );
    await harness.store.createOrg(Organization.createNew({ id: orgId, name: "Alpha", slug: "alpha-org", ownerUserId: ownerId, now }));
    await harness.store.createMembership(Membership.createActive({ id: ids.generate(), orgId, userId: ownerId, role: "owner", now }));

    const foreignOrgId = ids.generate();
    const foreignOwner = ids.generate();
    await harness.store.createUser(
      UserAccount.register({
        id: foreignOwner,
        emailNormalized: "foreign@example.test",
        displayName: "Foreign",
        passwordHash: "hash",
        now,
      }),
    );
    await harness.store.createOrg(
      Organization.createNew({ id: foreignOrgId, name: "Beta", slug: "beta-org", ownerUserId: foreignOwner, now }),
    );
    await harness.store.createMembership(
      Membership.createActive({ id: ids.generate(), orgId: foreignOrgId, userId: foreignOwner, role: "owner", now }),
    );

    for (let i = 0; i < 10_000; i += 1) {
      const userId = ids.generate();
      await harness.store.createUser(
        UserAccount.register({
          id: userId,
          emailNormalized: `u${i}@example.test`,
          displayName: `U${i}`,
          passwordHash: "hash",
          now,
        }),
      );
      await harness.store.createMembership(
        Membership.createActive({ id: ids.generate(), orgId, userId, role: "member", now }),
      );
    }

    const handle = createListMembersHandler(harness.deps);
    const ctx = createRequestContext({
      actor: {
        userId: ownerId,
        sessionId: ids.generate(),
        sessionTokenDigest: new Uint8Array(32),
        activeOrgId: orgId,
        activeRole: "owner",
        isPlatformAdmin: false,
        emailNormalized: "owner@example.test",
        displayName: "Owner",
      },
    });

    const samples: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const start = performance.now();
      const page = await handle({ type: LIST_MEMBERS_TYPE, limit: 25 }, ctx);
      samples.push(performance.now() - start);
      expect(page.items.length).toBeLessThanOrEqual(MAX_PAGE_LIMIT);
      expect(page.items.every((m) => m.email.endsWith("@example.test"))).toBe(true);
      expect(page.roleCounts.owner).toBe(1);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.max(0, Math.ceil(samples.length * 0.95) - 1)];
    expect(p95).toBeLessThan(300);
  }, 30_000);

  it("password KDF is not weakened to meet the read budget", () => {
    const hasher = readFileSync("src/infrastructure/identity/auth/argon2-hasher.ts", "utf-8");
    expect(hasher).toMatch(/memoryCost:\s*19456|m=19456|memoryCost:\s*19_456/);
    expect(hasher).toMatch(/timeCost:\s*2|t:\s*2/);
    expect(hasher).not.toMatch(/memoryCost:\s*[1-9]\d{0,3}[^0-9]/);
  });

  it("switch and list queries are indexed by org_id", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf-8");
    expect(schema).toMatch(/membership_org_created_idx/);
    expect(schema).toMatch(/invitation_org_status_idx/);
    expect(schema).toMatch(/session_active_org_revoked_idx/);
  });
});
