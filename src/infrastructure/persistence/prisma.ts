import { PrismaClient } from "../../generated/prisma/client";
import { getPgPool } from "./pg";
import { createRequire } from "node:module";

let prismaClient: PrismaClient | null = null;

export function createPrismaClient(): PrismaClient {
  try {
    const require = createRequire(import.meta.url);
    const adapterModule = require("@prisma/adapter-pg") as { PrismaPg: new (pool: unknown) => unknown };
    const pool = getPgPool();
    const adapter = new adapterModule.PrismaPg(pool);
    return new PrismaClient({ adapter } as never);
  } catch {
    return new PrismaClient();
  }
}

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = createPrismaClient();
  }
  return prismaClient;
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
}
