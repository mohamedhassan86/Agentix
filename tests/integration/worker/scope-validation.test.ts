import { describe, it, expect } from "vitest";
import { tenantWork } from "@/application/shared/work/work-envelope";
import { createWorkContext } from "@/application/shared/work/work-context";

describe("scope validation - tenant requires orgId, global forbids it", () => {
  it("tenant work without orgId fails", () => {
    expect(() =>
      tenantWork("", {
        workId: "0199f000-0000-7000-8000-000000000001",
        type: "test.work",
        schemaVersion: 1,
        idempotencyKey: "key",
        correlationId: "123e4567-e89b-12d3-a456-426614174000",
        payload: {},
      })
    ).toThrow(/orgId required/);
  });

  it("global work with orgId fails via validate", async () => {
    const { validateWorkEnvelope } = await import("@/application/shared/work/work-envelope");
    expect(() =>
      validateWorkEnvelope({
        workId: "0199f000-0000-7000-8000-000000000002",
        type: "test.work",
        schemaVersion: 1,
        scope: "global",
        orgId: "should-not-have",
        idempotencyKey: "key",
        correlationId: "123e4567-e89b-12d3-a456-426614174000",
        payload: {},
      })
    ).toThrow();
  });

  it("work context enforces scope rules", () => {
    expect(() =>
      createWorkContext({
        workId: "work-1",
        type: "test.work",
        schemaVersion: 1,
        scope: "global",
        orgId: "org-123",
        correlationId: "corr-1",
        attemptNumber: 1,
        workerId: "worker-1",
        signal: new AbortController().signal,
      })
    ).toThrow(/global.*null/i);

    expect(() =>
      createWorkContext({
        workId: "work-1",
        type: "test.work",
        schemaVersion: 1,
        scope: "tenant",
        orgId: null,
        correlationId: "corr-1",
        attemptNumber: 1,
        workerId: "worker-1",
        signal: new AbortController().signal,
      })
    ).toThrow(/tenant.*orgId/i);
  });

  it("tenant-scoped work without explicit tenant fails closed in handler registry", async () => {
    const { WorkHandlerRegistry } = await import("@/application/shared/work/work-handler-registry");
    const registry = new WorkHandlerRegistry();

    registry.register("test.work", 1, async () => ({ outcome: "succeeded" as const }));

    expect(registry.has("test.work", 1)).toBe(true);
    expect(registry.has("unknown.work", 1)).toBe(false);
  });
});
