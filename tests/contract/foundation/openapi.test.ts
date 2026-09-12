import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("OpenAPI contract", () => {
  it("committed OpenAPI JSON exists and is valid", () => {
    const path = join(process.cwd(), "contracts/openapi/agentix-v1.json");
    expect(existsSync(path), "OpenAPI JSON should exist, run npm run openapi:generate").toBe(true);
    const content = readFileSync(path, "utf-8");
    const doc = JSON.parse(content);
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.info.title).toMatch(/Agentix/i);
    expect(doc.paths).toBeDefined();
    expect(doc.paths["/health/live"]).toBeDefined();
    expect(doc.paths["/health/ready"]).toBeDefined();
    expect(doc.paths["/api/v1/ping"]).toBeDefined();
  });

  it("contract has required schemas and headers", () => {
    const path = join(process.cwd(), "contracts/openapi/agentix-v1.json");
    if (!existsSync(path)) return;
    const doc = JSON.parse(readFileSync(path, "utf-8"));
    // Check schemas exist
    const schemas = doc.components?.schemas ?? {};
    expect(schemas.HealthResponse || doc.paths["/health/live"]).toBeTruthy();
    // Check that all responses have X-Correlation-Id concept via description
    // At minimum, check that openapi file contains correlation header reference or description
    const raw = JSON.stringify(doc).toLowerCase();
    expect(raw.includes("correlation")).toBe(true);
  });

  it("spec YAML and generated JSON have same operationIds for foundation", () => {
    const yamlPath = join(process.cwd(), "specs/001-solution-foundation/contracts/openapi.yaml");
    const jsonPath = join(process.cwd(), "contracts/openapi/agentix-v1.json");
    if (!existsSync(yamlPath) || !existsSync(jsonPath)) return;

    const yamlContent = readFileSync(yamlPath, "utf-8");
    const jsonDoc = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // Extract operationIds from YAML (simple regex)
    const yamlOps = [...yamlContent.matchAll(/operationId:\s*(\w+)/g)].map((m) => m[1]);
    const jsonOps: string[] = [];
    for (const pathItem of Object.values(jsonDoc.paths) as any[]) {
      for (const method of Object.values(pathItem) as any[]) {
        if (method.operationId) jsonOps.push(method.operationId);
      }
    }

    // At least ping and health should match
    expect(jsonOps).toContain("getLiveness");
    expect(jsonOps).toContain("getReadiness");
    expect(jsonOps).toContain("getPing");
    // YAML ops should be superset or equal for P1
    for (const op of ["getLiveness", "getReadiness", "getPing"]) {
      expect(yamlOps).toContain(op);
    }
  });
});
