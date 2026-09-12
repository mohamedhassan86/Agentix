import { describe, it, expect } from "vitest";
import { isAllowedMetricLabel, isAllowedSpanAttribute, sanitizeAttributes } from "@/infrastructure/observability/telemetry";
import { validateTraceParent, validateTraceState } from "@/infrastructure/observability/propagation";

describe("telemetry attribute allow-lists", () => {
  it("rejects UUID/payload/error as metric labels", () => {
    expect(isAllowedMetricLabel("correlation_id")).toBe(false);
    expect(isAllowedMetricLabel("work_id")).toBe(false);
    expect(isAllowedMetricLabel("payload")).toBe(false);
    expect(isAllowedMetricLabel("error_detail")).toBe(false);
    expect(isAllowedMetricLabel("user_id")).toBe(false);
  });

  it("allows bounded safe metric labels", () => {
    expect(isAllowedMetricLabel("operation")).toBe(true);
    expect(isAllowedMetricLabel("status")).toBe(true);
    expect(isAllowedMetricLabel("service")).toBe(true);
    expect(isAllowedMetricLabel("dependency")).toBe(true);
  });

  it("rejects sensitive span attributes", () => {
    expect(isAllowedSpanAttribute("password")).toBe(false);
    expect(isAllowedSpanAttribute("authorization")).toBe(false);
    expect(isAllowedSpanAttribute("payload")).toBe(false);
  });

  it("allows safe span attributes", () => {
    expect(isAllowedSpanAttribute("operation")).toBe(true);
    expect(isAllowedSpanAttribute("work_type")).toBe(true);
    expect(isAllowedSpanAttribute("correlation_id")).toBe(true);
  });

  it("sanitizes attributes by allow-list", () => {
    const input = {
      operation: "ping",
      correlation_id: "test-id",
      password: "secret",
      payload: "should be removed",
    };
    const sanitized = sanitizeAttributes(input, isAllowedMetricLabel);
    expect(sanitized).toHaveProperty("operation");
    expect(sanitized).not.toHaveProperty("password");
    expect(sanitized).not.toHaveProperty("payload");
  });

  it("validates W3C traceparent", () => {
    const valid = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    expect(validateTraceParent(valid)).toBe(true);
    expect(validateTraceParent("invalid")).toBe(false);
    expect(validateTraceParent("00-invalid-traceparent")).toBe(false);
  });

  it("validates tracestate size bound 512", () => {
    const valid = "rojo=00f067aa0ba902b7,congo=t61rcWkgMzE";
    expect(validateTraceState(valid)).toBe(true);
    const tooLong = "a".repeat(513);
    expect(validateTraceState(tooLong)).toBe(false);
  });
});
