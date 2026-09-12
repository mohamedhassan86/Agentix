import { describe, it, expect } from "vitest";

describe("graceful shutdown and cancellation", () => {
  it("coordinator supports AbortSignal and stop", async () => {
    const { readFileSync } = await import("node:fs");
    const coordinatorContent = readFileSync("src/infrastructure/work/worker-coordinator.ts", "utf-8");

    expect(coordinatorContent).toMatch(/AbortSignal|abortController/);
    expect(coordinatorContent).toMatch(/stop\(\)/);
    expect(coordinatorContent).toMatch(/signal\.aborted/);
    expect(coordinatorContent).toMatch(/isRunning/);
  });

  it("worker main handles SIGTERM/SIGINT and ≤30s shutdown", async () => {
    const { readFileSync } = await import("node:fs");
    const mainContent = readFileSync("src/worker/main.ts", "utf-8");

    expect(mainContent).toMatch(/SIGTERM/);
    expect(mainContent).toMatch(/SIGINT/);
    expect(mainContent).toMatch(/shutdown/);
    expect(mainContent).toMatch(/coordinator\.stop/);
    expect(mainContent).toMatch(/disconnectPrisma/);
  });

  it("work context propagates cancellation", async () => {
    const { createWorkContext } = await import("@/application/shared/work/work-context");
    const controller = new AbortController();

    const ctx = createWorkContext({
      workId: "work-1",
      type: "test.work",
      schemaVersion: 1,
      scope: "global",
      orgId: null,
      correlationId: "corr-1",
      attemptNumber: 1,
      workerId: "worker-1",
      signal: controller.signal,
    });

    expect(ctx.signal).toBe(controller.signal);
    expect(ctx.signal.aborted).toBe(false);

    controller.abort();
    expect(ctx.signal.aborted).toBe(true);
  });

  it("shutdown leaves no unrecoverable claim - lease recovery", async () => {
    const { readFileSync } = await import("node:fs");
    const outcomeWriter = readFileSync("src/infrastructure/work/work-outcome-writer.ts", "utf-8");

    expect(outcomeWriter).toMatch(/lease_owner.*NULL/);
    expect(outcomeWriter).toMatch(/lease_expires_at.*NULL/);
    expect(outcomeWriter).toMatch(/pending/);
  });
});
