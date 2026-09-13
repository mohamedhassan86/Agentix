import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { TenantScopedClient } from "@/infrastructure/identity/tenancy/scoped-client";

describe("identity query plans", () => {
  const sql = readFileSync("prisma/migrations/20250913000000_002_tenancy_identity/migration.sql", "utf-8");
  const schema = readFileSync("prisma/schema.prisma", "utf-8");

  it("tenant-leading indexes exist for memberships and invitations", () => {
    expect(sql).toMatch(/membership_org_created_idx|CREATE INDEX.*org_id.*created_at/i);
    expect(sql).toMatch(/invitation_org_status_idx|CREATE INDEX.*org_id.*status/i);
    expect(schema).toMatch(/@@index\(\[orgId, createdAt, id\]/);
    expect(schema).toMatch(/@@index\(\[orgId, status, createdAt, id\]/);
  });

  it("scoped client throws before querying when tenant context is absent", () => {
    expect(
      () =>
        new TenantScopedClient({
          prisma: {} as never,
          tenantContext: { mode: "UnscopedIdentity", userId: "u1", isPlatformAdmin: false },
        }),
    ).toThrow(/TENANT_CONTEXT_REQUIRED/);
  });

  it("list repositories always include orgId in where", () => {
    const membership = readFileSync("src/infrastructure/identity/persistence/membership-repository.ts", "utf-8");
    const invitation = readFileSync("src/infrastructure/identity/persistence/invitation-repository.ts", "utf-8");
    expect(membership).toMatch(/where:\s*\{\s*orgId/);
    expect(invitation).toMatch(/where:\s*\{[\s\S]*orgId/);
    expect(membership).toMatch(/orderBy:\s*\[\{\s*createdAt/);
    expect(invitation).toMatch(/orderBy:\s*\[\{\s*createdAt/);
  });
});
