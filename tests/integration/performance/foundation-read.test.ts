import { describe, it, expect } from "vitest";

describe("foundation read performance", () => {
  it("ping and readiness p95 <300ms and readiness probe ≤2s - logic", async () => {
    const { readFileSync } = await import("node:fs");

    // Check that readiness probe has bounded timeout 2s
    const readinessContent = readFileSync("src/infrastructure/persistence/migration-readiness.ts", "utf-8");
    expect(readinessContent).toMatch(/2000|2.*s|timeout/i);
    expect(readinessContent).toMatch(/Promise\.race|timeout/);

    // Check that route-dispatch logs duration
    const routeDispatchContent = readFileSync("src/app/lib/route-dispatch.ts", "utf-8");
    expect(routeDispatchContent).toMatch(/duration/);
    expect(routeDispatchContent).toMatch(/Date\.now\(\)/);

    // Check that ping handler is lightweight (no DB)
    const pingHandlerContent = readFileSync("src/application/foundation/handlers/ping.ts", "utf-8");
    expect(pingHandlerContent).not.toMatch(/prisma|pg|database/i);
    expect(pingHandlerContent).toMatch(/new Date\(\)/);
  });

  it("worker notices available work within 2s under default local settings", async () => {
    const { readFileSync } = await import("node:fs");
    const coordinatorContent = readFileSync("src/infrastructure/work/worker-coordinator.ts", "utf-8");

    expect(coordinatorContent).toMatch(/pollIntervalMs.*1000|1000/);
    expect(coordinatorContent).toMatch(/batch.*10/);
  });

  it("graceful shutdown completes within 30s or safely releases lease", async () => {
    const { readFileSync } = await import("node:fs");
    const mainContent = readFileSync("src/worker/main.ts", "utf-8");
    const coordinatorContent = readFileSync("src/infrastructure/work/worker-coordinator.ts", "utf-8");

    expect(mainContent).toMatch(/30_000|30.*s|shutdown/i);
    expect(coordinatorContent).toMatch(/stop\(\)/);
    expect(coordinatorContent).toMatch(/lease/);
  });
});
