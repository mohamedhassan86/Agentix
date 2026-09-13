import { describe, it, expect } from "vitest";
import { classifyDatabaseFailure, isDatabaseFailure } from "@/infrastructure/persistence/db-diagnostics";

describe("database failure classification", () => {
  it("classifies socket failures that mean the server cannot be reached", () => {
    expect(classifyDatabaseFailure(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }))).toMatchObject({
      dependency: "database",
      reason: "connection_refused",
    });
    expect(classifyDatabaseFailure(Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }))?.reason).toBe(
      "connection_refused"
    );
    expect(classifyDatabaseFailure(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }))?.reason).toBe("connection_timeout");
  });

  it("classifies Postgres SQLSTATE codes", () => {
    expect(classifyDatabaseFailure(Object.assign(new Error("auth"), { code: "28P01" }))?.reason).toBe("authentication_failed");
    expect(classifyDatabaseFailure(Object.assign(new Error("no db"), { code: "3D000" }))?.reason).toBe("database_missing");
    expect(classifyDatabaseFailure(Object.assign(new Error("too many"), { code: "53300" }))?.reason).toBe("too_many_connections");
    expect(classifyDatabaseFailure(Object.assign(new Error("shutdown"), { code: "57P03" }))?.reason).toBe("server_unavailable");
  });

  it("maps an undefined table to a schema dependency, not a database outage", () => {
    const classified = classifyDatabaseFailure(Object.assign(new Error('relation "_prisma_migrations" does not exist'), { code: "42P01" }));
    expect(classified).toMatchObject({ dependency: "schema", reason: "migration_table_missing", sqlState: "42P01" });
  });

  it("classifies Prisma codes surfaced through the ORM", () => {
    expect(classifyDatabaseFailure(Object.assign(new Error("can't reach"), { code: "P1001" }))?.reason).toBe("connection_refused");
    expect(classifyDatabaseFailure(Object.assign(new Error("auth"), { code: "P1000" }))?.reason).toBe("authentication_failed");
    expect(classifyDatabaseFailure(Object.assign(new Error("missing table"), { code: "P2021" }))).toMatchObject({
      dependency: "schema",
      reason: "migration_table_missing",
    });
  });

  it("reads a nested cause code (driver errors wrapped by callers)", () => {
    const wrapped = new Error("query failed", { cause: Object.assign(new Error("connection terminated"), { code: "ECONNRESET" }) });
    expect(classifyDatabaseFailure(wrapped)?.reason).toBe("connection_failed");
  });

  it("returns null for errors that are not database failures", () => {
    expect(classifyDatabaseFailure(new Error("Failed with postgres://user:pass@localhost/db"))).toBeNull();
    expect(classifyDatabaseFailure(Object.assign(new Error("validation"), { code: "VALIDATION_FAILED" }))).toBeNull();
    expect(classifyDatabaseFailure(undefined)).toBeNull();
    expect(isDatabaseFailure(new Error("supersecret"))).toBe(false);
  });

  it("never needs the error message to classify", () => {
    const silent = Object.assign(new Error(""), { code: "08006" });
    expect(classifyDatabaseFailure(silent)).toMatchObject({ dependency: "database", reason: "connection_failed" });
    expect(isDatabaseFailure(silent)).toBe(true);
  });
});
