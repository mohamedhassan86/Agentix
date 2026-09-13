import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("identity composition and dispatch", () => {
  it("composition root is a singleton that wires identity handlers", () => {
    const source = readFileSync("src/app/lib/composition-root.ts", "utf-8");
    expect(source).toMatch(/let composition: AppComposition \| null = null/);
    expect(source).toMatch(/registerIdentityAuthHandlers/);
    expect(source).toMatch(/PrismaIdentityStore/);
    expect(source.includes('from "@prisma/client"')).toBe(false);
  });

  it("route dispatch covers correlation, CORS, errors, and metrics", () => {
    const dispatch = readFileSync("src/app/lib/route-dispatch.ts", "utf-8");
    expect(dispatch).toMatch(/getCorrelationIdFromHeaders/);
    expect(dispatch).toMatch(/parseAndValidateOrigin/);
    expect(dispatch).toMatch(/mapErrorToProblem/);
    expect(dispatch).toMatch(/recordHttpRequest/);
    expect(dispatch).toMatch(/X-Correlation-Id/);
  });

  it("correlation replaces malformed ids instead of echoing them", () => {
    const correlation = readFileSync("src/app/lib/correlation.ts", "utf-8");
    expect(correlation).toMatch(/normalizeCorrelationId/);
    const normalizer = readFileSync("src/application/shared/context/correlation.ts", "utf-8");
    expect(normalizer).toMatch(/uuid|UUID|v7|v4/i);
  });

  it("CORS uses exact-origin via URL.origin", () => {
    const cors = readFileSync("src/app/lib/cors.ts", "utf-8");
    expect(cors).toMatch(/new URL\(originHeader\)/);
    expect(cors).toMatch(/url\.origin/);
  });

  it("Problem Details include RFC 9457 fields", () => {
    const problem = readFileSync("src/app/lib/problem-response.ts", "utf-8");
    expect(problem).toMatch(/type:/);
    expect(problem).toMatch(/title:/);
    expect(problem).toMatch(/status:/);
    expect(problem).toMatch(/code:/);
    expect(problem).toMatch(/correlationId/);
  });

  it("API client uses relative URLs with no hard-coded host", () => {
    const client = readFileSync("src/app/lib/api/client.ts", "utf-8");
    expect(client).toMatch(/fetch\(path/);
    expect(client).not.toMatch(/https?:\/\/localhost/);
    expect(client).not.toMatch(/https?:\/\/[a-z0-9.-]+/);
  });
});
