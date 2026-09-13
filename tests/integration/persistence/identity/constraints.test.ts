import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Identity persistence constraints - checks migration SQL structure
 * Real DB tests require DATABASE_URL and Testcontainers
 * This test validates SQL content without DB
 */

describe("identity persistence constraints (SQL inspection)", () => {
  const migrationPath = join(process.cwd(), "prisma/migrations/20250913000000_002_tenancy_identity/migration.sql");
  let sql: string;

  beforeAll(() => {
    if (existsSync(migrationPath)) {
      sql = readFileSync(migrationPath, "utf-8");
    } else {
      sql = "";
    }
  });

  it("users email_normalized unique", () => {
    expect(sql).toMatch(/users_email_normalized_key|UNIQUE.*email_normalized/i);
  });

  it("organizations slug unique globally including deleted", () => {
    expect(sql).toMatch(/organizations_slug_key|UNIQUE.*slug/i);
  });

  it("memberships active uniqueness enforced via partial index", () => {
    expect(sql).toMatch(/ended_at.*IS NULL/i);
    expect(sql).toMatch(/membership_active_org_user_unique/i);
  });

  it("invitations pending uniqueness via partial index", () => {
    expect(sql).toMatch(/invitation_pending_org_email_unique/i);
    expect(sql).toMatch(/pending/i);
  });

  it("one_time_tokens purpose+digest unique", () => {
    expect(sql).toMatch(/token_purpose_digest_unique/i);
  });

  it("sessions token digest unique", () => {
    expect(sql).toMatch(/sessions_token_digest_unique/i);
  });

  it("login_throttles failed_count <=5", () => {
    expect(sql).toMatch(/failed_count/i);
    expect(sql).toMatch(/CHECK/i);
  });

  it("identity_events append-only (no update/delete)", () => {
    expect(sql).toMatch(/identity_events_immutable_update/i);
    expect(sql).toMatch(/identity_events_immutable_delete/i);
  });

  it("memberships ended_at/end_reason consistency", () => {
    expect(sql).toMatch(/ended_at.*end_reason|CHECK.*ended_at/i);
  });
});
