import { describe, it, expect } from "vitest";

describe("ping and error baseline (integration)", () => {
  // These tests require a running server; they are skipped in unit mode but will run in integration
  // For now we test the Problem mapping and correlation utilities

  it("ProblemDetails has required RFC9457 fields", async () => {
    const { createProblemDetails } = await import("@/application/shared/errors/problem-dto");
    const problem = createProblemDetails({
      title: "Not found",
      status: 404,
      code: "NOT_FOUND",
      correlationId: "123e4567-e89b-12d3-a456-426614174000",
      detail: "Resource not found",
    });
    expect(problem.type).toBeDefined();
    expect(problem.title).toBeDefined();
    expect(problem.status).toBe(404);
    expect(problem.code).toMatch(/^[A-Z_]+$/);
    expect(problem.correlationId).toBeDefined();
  });

  it("correlation normalization replaces malformed", async () => {
    const { normalizeCorrelationId } = await import("@/application/shared/context/correlation");
    const good = normalizeCorrelationId("123e4567-e89b-12d3-a456-426614174000");
    expect(good).toBe("123e4567-e89b-12d3-a456-426614174000");

    const bad = normalizeCorrelationId("not-a-uuid");
    expect(bad).not.toBe("not-a-uuid");
    expect(bad).toMatch(/^[0-9a-f-]{36}$/i);

    const long = normalizeCorrelationId("a".repeat(100));
    expect(long.length).toBeLessThan(100);
  });

  it("CORS exact-origin validation denies disallowed", async () => {
    const { parseAndValidateOrigin, isOriginAllowed } = await import("@/app/lib/cors");
    const allowed = ["https://example.com", "https://app.example.com"];

    const origin = parseAndValidateOrigin("https://example.com");
    expect(origin).toBe("https://example.com");
    expect(isOriginAllowed(origin, allowed)).toBe(true);

    const bad = parseAndValidateOrigin("https://evil.com");
    expect(isOriginAllowed(bad, allowed)).toBe(false);

    const malformed = parseAndValidateOrigin("not-a-url");
    expect(malformed).toBeNull();
  });

  it("client uses relative URL (no absolute localhost)", async () => {
    const { readFileSync } = await import("node:fs");
    const clientPath = "src/app/lib/api/client.ts";
    const content = readFileSync(clientPath, "utf-8");
    expect(content.includes("http://localhost")).toBe(false);
    expect(content.includes("https://")).toBe(false);
    expect(content.includes('"/health/live"') || content.includes("'/health/live'") || content.includes("/health/live")).toBe(true);
  });
});
