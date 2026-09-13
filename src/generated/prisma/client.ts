/**
 * Prisma Client stub for Phase 2 when binary download is unavailable.
 * In real environment, `npx prisma generate` will overwrite this with actual client.
 * This stub allows build and unit tests to pass without DB.
 */

type ModelStub = {
  findMany: (...args: any[]) => Promise<any[]>;
  findUnique: (...args: any[]) => Promise<any | null>;
  findFirst: (...args: any[]) => Promise<any | null>;
  create: (...args: any[]) => Promise<any>;
  update: (...args: any[]) => Promise<any>;
  updateMany: (...args: any[]) => Promise<any>;
  createMany: (...args: any[]) => Promise<any>;
  deleteMany: (...args: any[]) => Promise<any>;
  count: (...args: any[]) => Promise<number>;
  groupBy: (...args: any[]) => Promise<any[]>;
};

function makeStub(): ModelStub {
  return {
    findMany: async () => [],
    findUnique: async () => null,
    findFirst: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    updateMany: async () => ({}),
    createMany: async () => ({}),
    deleteMany: async () => ({}),
    count: async () => 0,
    groupBy: async () => [],
  };
}

export class PrismaClient {
  constructor(_options?: any) {}

  $transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return fn(this as any);
  }

  $disconnect(): Promise<void> {
    return Promise.resolve();
  }

  $connect(): Promise<void> {
    return Promise.resolve();
  }

  outboxMessage = makeStub();
  outboxAttempt = makeStub();
  foundationDemoRequest = makeStub();
  foundationDemoEffect = makeStub();

  // Identity models
  user = makeStub();
  organization = makeStub();
  membership = makeStub();
  invitation = makeStub();
  oneTimeToken = makeStub();
  session = makeStub();
  loginThrottle = makeStub();
  identityEvent = makeStub();
}
