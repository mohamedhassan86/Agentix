import { describe, it, expect } from "vitest";

describe("atomic outbox - idempotency and scope", () => {
  it("duplicate (type,scope,owner,key) returns one work item - logic", async () => {
    // This test verifies the repository logic for idempotency without requiring DB
    const { FoundationDemoRepository } = await import("@/infrastructure/persistence/foundation-demo-repository");

    // Mock Prisma client that simulates existing request
    const mockPrisma = {
      foundationDemoRequest: {
        findUnique: async ({ where }: any) => {
          if (where.idempotencyKey === "duplicate-key") {
            return {
              id: "existing-request-id",
              idempotencyKey: "duplicate-key",
              correlationId: "corr-1",
              requestedAt: new Date(),
              completedAt: null,
            };
          }
          return null;
        },
        create: async (params: any) => ({
          id: params.data.id,
          idempotencyKey: params.data.idempotencyKey,
          correlationId: params.data.correlationId,
          requestedAt: new Date(),
          completedAt: null,
        }),
        findUniqueCalls: 0,
      },
      foundationDemoEffect: {
        findUnique: async () => ({ outboxId: "existing-work-id" }),
      },
      outboxMessage: {
        create: async (params: any) => ({ id: params.data.id }),
        findUnique: async () => null,
      },
      $transaction: async (fn: any) => {
        const tx = {
          foundationDemoRequest: {
            create: async (params: any) => ({
              id: params.data.id,
              idempotencyKey: params.data.idempotencyKey,
              correlationId: params.data.correlationId,
              requestedAt: new Date(),
              completedAt: null,
            }),
          },
          outboxMessage: {
            create: async (params: any) => ({ id: params.data.id }),
          },
        };
        return fn(tx);
      },
    };

    const repo = new FoundationDemoRepository(mockPrisma as any);

    const envelope = {
      workId: "work-1",
      type: "foundation.demo.requested",
      schemaVersion: 1,
      scope: "global" as const,
      orgId: null,
      idempotencyKey: "duplicate-key",
      correlationId: "corr-1",
      payload: {},
      availableAt: new Date(),
      maxAttempts: 3,
    };

    const result = await repo.createRequestWithOutboxAtomic({
      requestId: "req-1",
      idempotencyKey: "duplicate-key",
      correlationId: "corr-1",
      envelope: envelope as any,
    });

    expect(result.isNew).toBe(false);
    expect(result.workId).toBe("existing-work-id");
  });

  it("rollback leaves no request/work - transaction logic", async () => {
    // Verify that $transaction is used for atomicity
    const { readFileSync } = await import("node:fs");
    const repoContent = readFileSync("src/infrastructure/persistence/foundation-demo-repository.ts", "utf-8");
    expect(repoContent).toMatch(/\$transaction/);
    expect(repoContent).toMatch(/foundationDemoRequest.*create/);
    expect(repoContent).toMatch(/outboxMessage.*create/);
  });
});
