import { describe, it, expect } from "vitest";
import { Organization } from "@/domain/identity/entities/organization";

describe("Organization", () => {
  const now = new Date();

  it("creates with owner", () => {
    const org = Organization.createNew({
      id: "0199f000-0000-7000-8000-000000000010",
      name: "Alpha Org",
      slug: "alpha-org",
      ownerUserId: "0199f000-0000-7000-8000-000000000001",
      now,
    });
    expect(org.ownerUserId).toBe("0199f000-0000-7000-8000-000000000001");
    expect(org.deletedAt).toBeNull();
  });

  it("rename and slug change", () => {
    const org = Organization.createNew({
      id: "0199f000-0000-7000-8000-000000000011",
      name: "Alpha",
      slug: "alpha",
      ownerUserId: "user1",
      now,
    });
    org.rename({ name: "Beta", now });
    expect(org.name).toBe("Beta");
  });

  it("transfer ownership", () => {
    const org = Organization.createNew({
      id: "0199f000-0000-7000-8000-000000000012",
      name: "Alpha",
      slug: "alpha",
      ownerUserId: "user1",
      now,
    });
    org.transferOwnership({ newOwnerUserId: "user2", now });
    expect(org.ownerUserId).toBe("user2");
  });

  it("blocks transfer to same owner", () => {
    const org = Organization.createNew({
      id: "0199f000-0000-7000-8000-000000000013",
      name: "Alpha",
      slug: "alpha",
      ownerUserId: "user1",
      now,
    });
    expect(() => org.transferOwnership({ newOwnerUserId: "user1", now })).toThrow();
  });

  it("deletion requires confirmation slug check", () => {
    const org = Organization.createNew({
      id: "0199f000-0000-7000-8000-000000000014",
      name: "Alpha",
      slug: "alpha-org",
      ownerUserId: "user1",
      now,
    });
    expect(() => org.verifyDeletionConfirmation("wrong-slug")).toThrow(/MISMATCH/);
    org.verifyDeletionConfirmation("alpha-org");
    org.markDeleted(now);
    expect(org.isDeleted()).toBe(true);
    expect(() => org.rename({ name: "new", now })).toThrow(/DELETED/);
  });
});
