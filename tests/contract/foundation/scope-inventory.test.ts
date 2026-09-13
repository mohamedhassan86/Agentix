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
      } else if (entry === "route.ts") {
        files.push(full);
      }
    }
  } catch {
    void 0;
  }
  return files;
}

describe("scope inventory - no out-of-scope surface", () => {
  it("route inventory contains only foundation operations", () => {
    const routes = collectRouteFiles("src/app");
    const routePaths = routes.map((f) => f.replace("src/app", "").replace("/route.ts", ""));

    for (const route of routePaths) {
      const isAllowed =
        route.startsWith("/health") ||
        route.startsWith("/api/v1/ping") ||
        route.startsWith("/api/v1/foundation") ||
        route.startsWith("/api/v1/auth") ||
        route.startsWith("/api/v1/account") ||
        route.startsWith("/api/v1/session") ||
        route.startsWith("/api/v1/organizations") ||
        route.startsWith("/api/v1/organization") ||
        route.startsWith("/api/v1/invitations") ||
        route.startsWith("/api/v1/platform") ||
        route.startsWith("/(auth)") ||
        route.startsWith("/(identity)");
      expect(isAllowed || route === "" || route === "/", `Route ${route} should be foundation or identity`).toBe(true);
    }

    const forbiddenRouteSegments = [
      "projects",
      "secrets",
      "providers",
      "runs",
      "billing",
      "metering",
      "webhooks",
      "simulator",
      "approval",
    ];

    for (const route of routePaths) {
      for (const forbidden of forbiddenRouteSegments) {
        expect(route.includes(`/${forbidden}`), `Route ${route} should not contain forbidden segment ${forbidden}`).toBe(false);
      }
    }
  });

  it("prisma schema has zero customer business tables beyond allowed identity", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf-8").toLowerCase();

    // 002-tenancy-identity explicitly allows identity models
    // Forbidden are still project, secret, run, billing, provider, metering, webhook etc beyond identity
    const forbiddenModels = [
      "model project",
      "model secret",
      "model run",
      "model metering",
      "model billing",
      "model webhook",
      "model provider",
    ];

    for (const forbidden of forbiddenModels) {
      expect(schema.includes(forbidden), `Schema should not contain ${forbidden}`).toBe(false);
    }

    // Foundation models must still exist
    expect(schema).toMatch(/model outboxmessage/i);
    expect(schema).toMatch(/model outboxattempt/i);
    expect(schema).toMatch(/model foundationdemorequest/i);
    expect(schema).toMatch(/model foundationdemoeffect/i);

    // Identity models are allowed per 002 spec - verify they exist if post-002
    // (No assertion that they must NOT exist - they are allowed)
  });

  it("no paid/external calls in codebase", async () => {
    const { execSync } = await import("node:child_process");
    try {
      const result = execSync(
        `grep -r "openai\\|anthropic\\|stripe\\|billing\\|webhook.*fetch" src --include="*.ts" --include="*.tsx" | grep -v "foundation" | head -n 20`,
        {
          encoding: "utf-8",
        }
      );
      expect(result.trim()).toBe("");
    } catch (e: any) {
      if (e.status === 1) {
        expect(e.stdout?.trim() ?? "").toBe("");
      } else {
        throw e;
      }
    }
  });
});
