/**
 * Prisma Client stub for Phase 2 when binary download is unavailable.
 * In real environment, `npx prisma generate` will overwrite this with actual client.
 * This stub allows build and unit tests to pass without DB.
 */

export const __AGENTIX_STUB_PRISMA_CLIENT = true;

export class PrismaClient {
  constructor(_options?: any) {}

  $transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    // For stub, just execute without transaction
    return fn(this as any);
  }

  $disconnect(): Promise<void> {
    return Promise.resolve();
  }

  $connect(): Promise<void> {
    return Promise.resolve();
  }

  // Mock models - will be overridden by real client
  outboxMessage = {
    findMany: async () => [],
    findUnique: async () => null,
    findFirst: async () => null,
    create: async () => ({}),
    update: async () => ({}),
  };

  outboxAttempt = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async () => ({}),
    update: async () => ({}),
  };

  foundationDemoRequest = {
    findUnique: async () => null,
    findFirst: async () => null,
    create: async () => ({}),
    update: async () => ({}),
  };

  foundationDemoEffect = {
    findUnique: async () => null,
    findFirst: async () => null,
    create: async () => ({}),
  };
}
