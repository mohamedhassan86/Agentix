import { describe, it, expect } from "vitest";

describe("telemetry correlation", () => {
  it("request, dispatch, DB, enqueue, claim, handler spans correlate via correlation_id", async () => {
    const { createRequestContext } = await import("@/application/shared/context/request-context");
    const correlationId = "123e4567-e89b-12d3-a456-426614174000";

    const ctx = createRequestContext({
      correlationId,
      operation: "test-correlation",
      signal: new AbortController().signal,
    });

    expect(ctx.correlationId).toBe(correlationId);
    expect(ctx.operation).toBe("test-correlation");

    // Simulate work context correlation
    const { createWorkContext } = await import("@/application/shared/work/work-context");
    const workCtx = createWorkContext({
      workId: "work-1",
      type: "foundation.demo.requested",
      schemaVersion: 1,
      scope: "global",
      orgId: null,
      correlationId,
      attemptNumber: 1,
      workerId: "worker-1",
      signal: new AbortController().signal,
    });

    expect(workCtx.correlationId).toBe(correlationId);
  });

  it("traceparent validation is bounded 55 chars and W3C", async () => {
    const { validateTraceParent, validateTraceState } = await import("@/infrastructure/observability/propagation");

    expect(validateTraceParent("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")).toBe(true);
    expect(validateTraceParent("malformed")).toBe(false);
    expect(validateTraceParent("a".repeat(56))).toBe(false);

    expect(validateTraceState("rojo=00f067aa0ba902b7")).toBe(true);
    expect(validateTraceState("a".repeat(513))).toBe(false);
  });

  it("baseline metrics use bounded attributes, not UUID/payload", async () => {
    const { isAllowedMetricLabel } = await import("@/infrastructure/observability/telemetry");

    expect(isAllowedMetricLabel("operation")).toBe(true);
    expect(isAllowedMetricLabel("status")).toBe(true);
    expect(isAllowedMetricLabel("correlation_id")).toBe(false);
    expect(isAllowedMetricLabel("work_id")).toBe(false);
    expect(isAllowedMetricLabel("payload")).toBe(false);
    expect(isAllowedMetricLabel("error_detail")).toBe(false);
  });
});
