import { describe, it, expect } from "vitest";
import { createLogger, createTestSink } from "@/infrastructure/observability/logger";
import { containsSensitiveMarker, SENSITIVE_KEYS } from "@/infrastructure/observability/redaction";

describe("Pino redaction and secret omission", () => {
  it("redacts sensitive keys recursively", () => {
    const sink = createTestSink();
    const logger = createLogger({ sink: sink as any, level: "info" });

    logger.info({
      user: "test",
      password: "supersecret123",
      nested: { token: "tok_abc", safe: "ok" },
      authorization: "Bearer secret",
      cookie: "session=abc",
    });

    const logs = sink.getLogs();
    expect(logs.length).toBeGreaterThan(0);
    const logStr = JSON.stringify(logs);
    expect(logStr).not.toContain("supersecret123");
    expect(logStr).not.toContain("tok_abc");
    expect(logStr).not.toContain("Bearer secret");
    expect(logStr).not.toContain("session=abc");
    expect(logStr).toContain("safe");
  });

  it("omits request/work bodies by default", () => {
    const sink = createTestSink();
    const logger = createLogger({ sink: sink as any, level: "info" });
    logger.info({ body: "should not log", payload: "secret payload" });
    const logs = sink.getLogs();
    const logStr = JSON.stringify(logs);
    // body/payload should not be logged as raw unless explicitly allowed
    // Our logger should not include body field at all or redacted
    // For this test, we check that sensitive body keys are not present as plain
    expect(logStr).not.toContain("should not log");
  });

  it("stores stable error codes not free-form details", () => {
    const sink = createTestSink();
    const logger = createLogger({ sink: sink as any, level: "info" });
    const err = new Error("DB connection failed with password=secret123");
    logger.error({ err, code: "DATABASE_UNAVAILABLE", correlationId: "test-id" });
    const logs = sink.getLogs();
    const logStr = JSON.stringify(logs);
    expect(logStr).toContain("DATABASE_UNAVAILABLE");
    expect(logStr).not.toContain("secret123");
  });

  it("child logger carries diagnostic context", () => {
    const sink = createTestSink();
    const logger = createLogger({ sink: sink as any, level: "info" });
    const child = logger.child({ correlationId: "corr-123", operation: "ping" });
    child.info("test");
    const logs = sink.getLogs();
    expect(logs[0]).toMatchObject({ correlationId: "corr-123", operation: "ping" });
  });

  it("sensitive marker detection works", () => {
    const marker = "SECRET_MARKER_12345";
    expect(containsSensitiveMarker(JSON.stringify({ key: marker }), marker)).toBe(true);
    expect(containsSensitiveMarker(JSON.stringify({ safe: "ok" }), marker)).toBe(false);
  });

  it("SENSITIVE_KEYS includes required fields", () => {
    const required = ["authorization", "cookie", "password", "token", "secret", "key", "connection"];
    for (const k of required) {
      expect(SENSITIVE_KEYS).toContain(k);
    }
  });
});
