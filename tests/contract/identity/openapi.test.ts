import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_OPS = [
  "registerAccount",
  "signIn",
  "signOut",
  "verifyEmail",
  "resendVerification",
  "getCurrentAccount",
  "deleteCurrentAccount",
  "getSessionContext",
  "listMyOrganizations",
  "createOrganization",
  "suggestOrganizationSlug",
  "getActiveOrganization",
  "updateActiveOrganization",
  "deleteActiveOrganization",
  "listInvitations",
  "createInvitation",
  "resendInvitation",
  "revokeInvitation",
  "previewInvitation",
  "acceptInvitation",
  "listActiveOrganizationMembers",
  "changeMemberRole",
  "removeMember",
  "leaveActiveOrganization",
  "transferOwnership",
  "switchActiveOrganization",
  "inspectOrganization",
  "inspectOrganizationMembers",
  "inspectOrganizationInvitations",
];

describe("identity OpenAPI contract", () => {
  it("spec yaml lists required identity operationIds", () => {
    const yaml = readFileSync(join(process.cwd(), "specs/002-tenancy-identity/contracts/openapi.yaml"), "utf-8");
    for (const op of REQUIRED_OPS) {
      expect(yaml).toContain(`operationId: ${op}`);
    }
    expect(yaml).not.toMatch(/passwordHash|tokenDigest|sessionToken/);
  });

  it("committed OpenAPI json has no password/hash/token response fields", () => {
    const path = join(process.cwd(), "contracts/openapi/agentix-v1.json");
    expect(existsSync(path)).toBe(true);
    const doc = JSON.parse(readFileSync(path, "utf-8"));
    const json = JSON.stringify(doc);
    expect(json).not.toContain("passwordHash");
    expect(json).not.toContain("tokenDigest");
    expect(json).not.toContain("sessionToken");
    expect(json).not.toContain("supersecret");

    const problemCode = /^[A-Z][A-Z0-9_]{1,119}$/;
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      const rec = node as Record<string, unknown>;
      if (typeof rec.code === "string" && rec.code === rec.code.toUpperCase() && rec.code.includes("_")) {
        expect(rec.code).toMatch(problemCode);
      }
      for (const value of Object.values(rec)) walk(value);
    };
    walk(doc);
  });
});
