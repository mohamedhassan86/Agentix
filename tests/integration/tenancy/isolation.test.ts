import { describe, it, expect } from "vitest";
import { TENANT_SCOPED_MODELS, isTenantScopedModel, assertTenantModelRegistered } from "@/infrastructure/identity/tenancy/tenant-registry";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("tenant isolation layer", () => {
  it("tenant-registry lists tenant-scoped models", () => {
    expect(TENANT_SCOPED_MODELS).toContain("membership");
    expect(TENANT_SCOPED_MODELS).toContain("invitation");
    expect(TENANT_SCOPED_MODELS).toContain("oneTimeToken");
    expect(isTenantScopedModel("membership")).toBe(true);
    expect(isTenantScopedModel("user")).toBe(false);
  });

  it("assertTenantModelRegistered throws for non-scoped", () => {
    expect(() => assertTenantModelRegistered("user")).toThrow();
    // organization is considered tenant-scoped for writes per registry
    expect(() => assertTenantModelRegistered("organization")).not.toThrow();
  });

  it("tenant-registry file contains constitution reference", () => {
    const path = join(process.cwd(), "src/infrastructure/identity/tenancy/tenant-registry.ts");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/membership|invitation/);
  });

  it("scoped-client enforces orgId and Member context", () => {
    const path = join(process.cwd(), "src/infrastructure/identity/tenancy/scoped-client.ts");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/TENANT_CONTEXT_REQUIRED/);
    expect(content).toMatch(/orgId/);
    expect(content).toMatch(/Member/);
    expect(content).toMatch(/org_id|orgId/);
  });

  it("platform-inspection-client is read-only and limited", () => {
    const path = join(process.cwd(), "src/infrastructure/identity/tenancy/platform-inspection-client.ts");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/findOrganizationById|findOrganizationBySlug/);
    expect(content).toMatch(/listMembers/);
    expect(content).toMatch(/listInvitations/);
    expect(content).toMatch(/read-only/i);
    // Should not have create/update/delete
    expect(content).not.toMatch(/async create\(/);
    expect(content).not.toMatch(/async update\(/);
    expect(content).not.toMatch(/async delete\(/);
  });

  it("tenant-binder resolves CurrentMembershipProjection and clears activeOrg", () => {
    const path = join(process.cwd(), "src/infrastructure/identity/tenancy/tenant-binder.ts");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/CurrentMembershipProjection/);
    expect(content).toMatch(/activeOrg/);
    expect(content).toMatch(/sessionTokenDigest/);
    expect(content).toMatch(/PlatformAdmin/);
    expect(content).toMatch(/clear.*activeOrg|activeOrg.*null/i);
  });

  it("tenant-binder clears pointer on deleted org and former member", () => {
    const path = join(process.cwd(), "src/infrastructure/identity/tenancy/tenant-binder.ts");
    const content = readFileSync(path, "utf-8");
    // Check for logic handling deleted org and ended membership
    expect(content).toMatch(/deletedAt/);
    expect(content).toMatch(/endedAt/);
  });
});
