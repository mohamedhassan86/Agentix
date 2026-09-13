import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("identity migration constraints", () => {
  const migrationPath = join(process.cwd(), "prisma/migrations/20250913000000_002_tenancy_identity/migration.sql");

  it("migration file exists and contains required tables", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf-8");

    expect(sql).toMatch(/users/i);
    expect(sql).toMatch(/organizations/i);
    expect(sql).toMatch(/memberships/i);
    expect(sql).toMatch(/invitations/i);
    expect(sql).toMatch(/one_time_tokens/i);
    expect(sql).toMatch(/sessions/i);
    expect(sql).toMatch(/login_throttles/i);
    expect(sql).toMatch(/identity_events/i);

    expect(sql).toMatch(/organization_role/i);
    expect(sql).toMatch(/invitable_role/i);
    expect(sql).toMatch(/invitation_status/i);
    expect(sql).toMatch(/token_purpose/i);
  });

  it("migration contains tenant isolation triggers and partial indexes", () => {
    const sql = readFileSync(migrationPath, "utf-8");

    // Partial unique active membership org+user
    expect(sql).toMatch(/membership_active_org_user_unique/i);
    // Partial unique active owner
    expect(sql).toMatch(/membership_active_owner_unique/i);
    // Partial pending invitation
    expect(sql).toMatch(/invitation_pending_org_email_unique/i);

    // Owner invariant deferred
    expect(sql).toMatch(/organization_owner_invariant/i);
    expect(sql).toMatch(/DEFERRABLE/i);

    // Platform admin zero memberships
    expect(sql).toMatch(/check_platform_admin_zero_memberships/i);

    // Immutable identity_events
    expect(sql).toMatch(/identity_events.*immutable|prevent_identity_events_mutation/i);
  });

  it("migration contains outbox extension columns", () => {
    const sql = readFileSync(migrationPath, "utf-8");
    expect(sql).toMatch(/message_kind/i);
    expect(sql).toMatch(/recipient_hash/i);
    expect(sql).toMatch(/ciphertext/i);
    expect(sql).toMatch(/nonce/i);
  });

  it("migration contains slug regex check", () => {
    const sql = readFileSync(migrationPath, "utf-8");
    expect(sql).toMatch(/slug/i);
    expect(sql).toMatch(/\^\[a-z0-9\]/);
  });

  it("schema.prisma has identity models", () => {
    const schemaPath = join(process.cwd(), "prisma/schema.prisma");
    const schema = readFileSync(schemaPath, "utf-8");

    expect(schema).toMatch(/model User/);
    expect(schema).toMatch(/model Organization/);
    expect(schema).toMatch(/model Membership/);
    expect(schema).toMatch(/model Invitation/);
    expect(schema).toMatch(/model OneTimeToken/);
    expect(schema).toMatch(/model Session/);
    expect(schema).toMatch(/model LoginThrottle/);
    expect(schema).toMatch(/model IdentityEvent/);
    expect(schema).toMatch(/enum OrganizationRole/);
  });
});
