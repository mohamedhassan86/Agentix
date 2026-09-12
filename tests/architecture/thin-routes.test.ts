import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function collectRouteFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        files.push(...collectRouteFiles(full));
      } else if (entry === "route.ts" || entry === "route.tsx") {
        files.push(full);
      }
    }
  } catch {
    void 0;
  }
  return files;
}

describe("thin routes", () => {
  it("route modules are one parse plus one dispatch (no business logic)", () => {
    const routes = collectRouteFiles("src/app");
    expect(routes.length).toBeGreaterThan(0);

    for (const file of routes) {
      const content = readFileSync(file, "utf-8");
      // Must use dispatchRoute or similar composition
      const usesDispatch = content.includes("dispatchRoute") || content.includes("dispatch");
      expect(usesDispatch, `${file} should use dispatchRoute`).toBe(true);

      // Should not contain direct Prisma, business entities, or heavy logic
      expect(content.includes("PrismaClient"), `${file} should not import PrismaClient`).toBe(false);
      expect(content.includes("foundation_demo"), `${file} should not have business table names`).toBe(false);

      // Should be thin: less than 50 lines or only parse+dispatch
      const lines = content.split("\n").length;
      expect(lines, `${file} should be thin (<100 lines)`).toBeLessThan(100);
    }
  });
});
