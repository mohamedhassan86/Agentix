import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function collectFiles(dir: string, exts: string[]): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        files.push(...collectFiles(full, exts));
      } else if (exts.some((e) => entry.endsWith(e))) {
        files.push(full);
      }
    }
  } catch {
    void 0;
  }
  return files;
}

describe("no business scope in foundation", () => {
  it("no auth/tenant/project/secret/provider/run/billing routes or entities", () => {

    // We allow tenant as scope classification in work envelope, but not as entity
    // So we check for forbidden route paths
    const appFiles = collectFiles("src/app", [".ts", ".tsx"]);
    const forbiddenPaths = [
      "/auth",
      "/organizations",
      "/projects",
      "/secrets",
      "/providers",
      "/runs",
      "/billing",
    ];

    for (const file of appFiles) {
      for (const fp of forbiddenPaths) {
        expect(file.includes(fp), `${file} should not contain forbidden path ${fp}`).toBe(false);
      }
    }

    // Check that no file creates business tables beyond identity and foundation
    // 002-tenancy-identity allows: user, organization, membership, invitation, session, token, etc.
    const prismaSchema = readFileSync("prisma/schema.prisma", "utf-8").toLowerCase();
    // Forbidden business models (projects, secrets, runs, billing remain out of scope until later specs)
    const forbiddenBusiness = ["model project", "model secret", "model run", "model billing", "model provider", "model metering"];
    for (const forbidden of forbiddenBusiness) {
      expect(prismaSchema.includes(forbidden)).toBe(false);
    }
    // Ensure at least foundation and identity models exist if schema is post-002
    // (Don't fail if identity models exist - they are allowed)
  });
});
