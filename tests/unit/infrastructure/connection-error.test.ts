import { describe, expect, it } from "vitest";
import { classifyConnectionError } from "@/infrastructure/persistence/connection-error";

function categorize(error: unknown) {
  return classifyConnectionError(error);
}

describe("connection failure classification", () => {
  const cases: Array<[unknown, string]> = [
    [{ code: "ENOTFOUND" }, "dns_not_resolved"],
    [{ code: "EAI_AGAIN" }, "dns_not_resolved"],
    [{ code: "ECONNREFUSED" }, "connection_refused"],
    [{ code: "ETIMEDOUT" }, "connect_timeout"],
    [{ message: "timeout exceeded when trying to connect" }, "connect_timeout"],
    [{ message: "timeout exceeded while acquiring a client from the pool" }, "pool_acquired_timeout"],
    [{ code: "28P01", message: "password authentication failed for user \"app\"" }, "auth_failed"],
    [{ code: "3D000" }, "database_not_found"],
    [{ code: "42P01", message: 'relation "outbox_messages" does not exist' }, "schema_not_migrated"],
    [{ code: "53300", message: "sorry, too many clients already" }, "too_many_connections"],
    [{ message: "self-signed certificate in certificate chain" }, "tls_handshake_failed"],
    [{ message: "no pg_hba.conf entry for host" }, "ip_not_allowed"],
    [{ code: "P2021" }, "schema_not_migrated"],
    [{ message: "DATABASE_URL is required to create pg Pool" }, "missing_config"],
    ["string error", "unknown"],
  ] as const;

  for (const [error, expected] of cases) {
    it(`maps ${expected}`, () => {
      expect(categorize(error).category).toBe(expected);
    });
  }

  it("always returns a remediation and a code", () => {
    const failure = categorize(new Error("boom"));
    expect(failure.remediation.length).toBeGreaterThan(20);
    expect(failure.code).toBe("UNKNOWN");
  });

  it("never echoes the driver message (which can contain host and user)", () => {
    const failure = categorize({
      code: "ECONNREFUSED",
      message: "connect ECONNREFUSED 10.0.0.7:5432 user=svc password=hunter2",
    });
    const serialised = JSON.stringify(failure);
    expect(serialised).not.toContain("hunter2");
    expect(serialised).not.toContain("10.0.0.7");
    expect(failure.code).toBe("ECONNREFUSED");
  });

  it("does not echo long driver payloads to callers", () => {
    const failure = categorize({ code: "UNKNOWN", message: "xyz".repeat(2000) });
    expect(failure.category).toBe("unknown");
    expect(JSON.stringify(failure)).not.toContain("xyz");
  });
});
