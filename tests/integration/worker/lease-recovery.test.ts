import { describe, it, expect } from "vitest";

describe("lease recovery - expired leases", () => {
  it("reaper uses FOR UPDATE SKIP LOCKED and resets to pending", async () => {
    const { readFileSync } = await import("node:fs");
    const reaperContent = readFileSync("src/infrastructure/work/postgres-lease-reaper.ts", "utf-8");

    expect(reaperContent).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(reaperContent).toMatch(/lease_expires_at.*<=.*NOW\(\)/i);
    expect(reaperContent).toMatch(/status.*pending/i);
    expect(reaperContent).toMatch(/lease_expired/i);
    expect(reaperContent).toMatch(/BEGIN/);
    expect(reaperContent).toMatch(/COMMIT/);
  });

  it("reaper is called before claim in coordinator", async () => {
    const { readFileSync } = await import("node:fs");
    const coordinatorContent = readFileSync("src/infrastructure/work/worker-coordinator.ts", "utf-8");

    expect(coordinatorContent).toMatch(/reapExpiredLeases/);
    // Reaper should be called before claimBatch
    const reaperIndex = coordinatorContent.indexOf("reapExpiredLeases");
    const claimIndex = coordinatorContent.indexOf("claimBatch");
    expect(reaperIndex).toBeLessThan(claimIndex);
  });
});
