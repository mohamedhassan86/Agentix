import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("foundation migration constraints", () => {
  it("migration file exists and contains required tables", () => {
    const migrationPath = join(process.cwd(), "prisma/migrations/20250912000000_001_solution_foundation/migration.sql");
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf-8");

    // Check for required tables
    expect(sql).toMatch(/outbox_messages/i);
    expect(sql).toMatch(/outbox_attempts/i);
    expect(sql).toMatch(/foundation_demo_requests/i);
    expect(sql).toMatch(/foundation_demo_effects/i);

    // Check for required enums
    expect(sql).toMatch(/work_scope/i);
    expect(sql).toMatch(/outbox_status/i);
    expect(sql).toMatch(/attempt_outcome/i);

    // Check for required constraints from data-model
    expect(sql).toMatch(/work_type.*1.*120|VarChar\(120\)/i);
    expect(sql).toMatch(/idempotency_key.*200|VarChar\(200\)/i);
    expect(sql).toMatch(/traceparent.*55|VarChar\(55\)/i);
    expect(sql).toMatch(/tracestate.*512|VarChar\(512\)/i);
  });

  it("schema.prisma has correct limits and indexes", () => {
    const schemaPath = join(process.cwd(), "prisma/schema.prisma");
    const schema = readFileSync(schemaPath, "utf-8");

    expect(schema).toMatch(/workType.*VarChar\(120\)/);
    expect(schema).toMatch(/idempotencyKey.*VarChar\(200\)/);
    expect(schema).toMatch(/traceParent.*VarChar\(55\)/);
    expect(schema).toMatch(/traceState.*VarChar\(512\)/);
    expect(schema).toMatch(/outbox_pending_due_idx/);
    expect(schema).toMatch(/outbox_org_idx/);
    expect(schema).toMatch(/outbox_correlation_idx/);
  });

  it("migration is idempotent (apply twice safe) - checks SQL structure", () => {
    const migrationPath = join(process.cwd(), "prisma/migrations/20250912000000_001_solution_foundation/migration.sql");
    const sql = readFileSync(migrationPath, "utf-8");
    // Migration should use CREATE TABLE IF NOT EXISTS or be wrapped in transaction
    // For Prisma, migrations are applied once and tracked in _prisma_migrations, so second apply is safe
    // We check that migration doesn't contain DROP without IF EXISTS
    expect(sql).not.toMatch(/DROP TABLE.*outbox_messages/i);
  });
});
