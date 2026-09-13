import { describe, it, expect } from "vitest";
import { AuthorizationPolicy } from "@/application/identity/policies/authorization-policy";

describe("authorization policy", () => {
  it("denies Member/Viewer invite, role-change, and remove", () => {
    expect(() => AuthorizationPolicy.assertCanInvite("member")).toThrow();
    expect(() => AuthorizationPolicy.assertCanInvite("viewer")).toThrow();
    expect(() => AuthorizationPolicy.assertCanChangeRole("member", "viewer", "admin")).toThrow();
    expect(() => AuthorizationPolicy.assertCanRemove("viewer", "member")).toThrow();
  });

  it("blocks Owner leave/remove/downgrade via general paths", () => {
    expect(() => AuthorizationPolicy.assertCanLeave("owner")).toThrow();
    expect(() => AuthorizationPolicy.assertCanRemove("admin", "owner")).toThrow();
    expect(() => AuthorizationPolicy.assertCanChangeRole("owner", "owner", "admin")).toThrow();
    expect(() => AuthorizationPolicy.assertCanChangeRole("admin", "member", "owner")).toThrow();
  });

  it("allows Owner transfer and Admin invite", () => {
    expect(() => AuthorizationPolicy.assertCanTransfer("owner")).not.toThrow();
    expect(() => AuthorizationPolicy.assertCanInvite("admin")).not.toThrow();
    expect(() => AuthorizationPolicy.assertCanListMembers("viewer", false)).not.toThrow();
  });
});
