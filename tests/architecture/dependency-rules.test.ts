import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

function runCruiser(target: string): { success: boolean; output: string } {
  try {
    const out = execSync(`npx depcruise ${target} --config .dependency-cruiser.cjs --output-type err`, {
      encoding: "utf-8",
      cwd: process.cwd(),
    });
    return { success: true, output: out };
  } catch (e: any) {
    const output = (e.stdout?.toString() ?? "") + (e.stderr?.toString() ?? "") + (e.message ?? "");
    return { success: false, output };
  }
}

describe("architecture conformance", () => {
  it("production graph has zero violations", () => {
    const result = runCruiser("src");
    expect(result.success).toBe(true);
  });

  it("domain-imports-infrastructure fixture fails with expected source and target", () => {
    const result = runCruiser("tests/architecture/fixtures/domain-imports-infrastructure.ts");
    expect(result.success).toBe(false);
    expect(result.output).toMatch(/domain/i);
    expect(result.output).toMatch(/infrastructure/i);
  });

  it("application-imports-prisma fixture fails", () => {
    const result = runCruiser("tests/architecture/fixtures/application-imports-prisma.ts");
    expect(result.success).toBe(false);
    expect(result.output).toMatch(/prisma|application/i);
  });

  it("app-imports-prisma fixture fails", () => {
    const result = runCruiser("tests/architecture/fixtures/app-imports-prisma.ts");
    expect(result.success).toBe(false);
    expect(result.output).toMatch(/prisma|app/i);
  });
});
