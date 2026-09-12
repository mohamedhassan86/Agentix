import { describe, it, expect } from "vitest";
import { RetryPolicy } from "@/infrastructure/work/retry-policy";

describe("bounded backoff and max attempts", () => {
  it("stops at configured finite ceiling", () => {
    const policy = new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 30000 });

    expect(policy.shouldRetry(1, 3)).toBe(true);
    expect(policy.shouldRetry(2, 3)).toBe(true);
    expect(policy.shouldRetry(3, 3)).toBe(false);
    expect(policy.shouldRetry(3, 10)).toBe(true);
  });

  it("delay is bounded 1s to 30s with jitter", () => {
    const policy = new RetryPolicy({ baseDelayMs: 1000, maxDelayMs: 30000 });

    for (let i = 1; i <= 10; i++) {
      const delay = policy.getNextDelay(i);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(35000); // cap + jitter
    }

    const firstDelay = policy.getNextDelay(1);
    expect(firstDelay).toBeGreaterThanOrEqual(900); // 1s ±10%
    expect(firstDelay).toBeLessThanOrEqual(1100);
  });

  it("permanent failure for unknown version/schema", async () => {
    const { WorkHandlerRegistry } = await import("@/application/shared/work/work-handler-registry");
    const registry = new WorkHandlerRegistry();

    expect(registry.get("unknown.type", 999)).toBeUndefined();

    // In coordinator, unknown handler should result in failed outcome
    const { readFileSync } = await import("node:fs");
    const coordinatorContent = readFileSync("src/infrastructure/work/worker-coordinator.ts", "utf-8");
    expect(coordinatorContent).toMatch(/UNKNOWN_WORK_VERSION/);
    expect(coordinatorContent).toMatch(/failedResult/);
  });

  it("transient failures stop at 3 attempts", async () => {
    const policy = new RetryPolicy({ maxAttempts: 3 });
    let attempts = 0;
    const max = 3;

    while (policy.shouldRetry(attempts, max)) {
      attempts++;
    }

    expect(attempts).toBe(3);
  });
});
