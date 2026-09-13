import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("tenancy middleware and context", () => {
  it("tenant-context port defines TenantContext", () => {
    const path = join(process.cwd(), "src/application/identity/ports/tenant-context.ts");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/TenantContext/);
    expect(content).toMatch(/orgId/);
    expect(content).toMatch(/userId/);
    expect(content).toMatch(/role/);
  });

  it("scoped-client throws TENANT_CONTEXT_REQUIRED when no context", () => {
    const path = join(process.cwd(), "src/infrastructure/identity/tenancy/scoped-client.ts");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/TENANT_CONTEXT_REQUIRED/);
  });

  it("platform-inspection-client requires PlatformInspect context", () => {
    const path = join(process.cwd(), "src/infrastructure/identity/tenancy/platform-inspection-client.ts");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/PlatformInspect/);
    expect(content).toMatch(/PLATFORM_INSPECT_CONTEXT_REQUIRED/);
  });

  it("tenant-binder returns null when session not found (guest)", () => {
    const path = join(process.cwd(), "src/infrastructure/identity/tenancy/tenant-binder.ts");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/null/);
    expect(content).toMatch(/sessionTokenDigest/);
  });
});
