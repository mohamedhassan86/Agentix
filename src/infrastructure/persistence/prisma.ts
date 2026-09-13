import * as generatedClient from "../../generated/prisma/client";
import { getPgPool } from "./pg";
import { createRequire } from "node:module";
import { createLogger } from "../observability/logger";

/**
 * `src/generated/prisma/client.ts` is a hand-written stub that satisfies the build
 * offline (see .gitignore: only that file is committed). It resolves every query to
 * `null`/`{}` and runs `$transaction` callbacks without any transaction — so if the
 * real client is not generated, the app answers requests "successfully" while writing
 * nothing to the database. That is exactly what a "Vercel can't reach my DB" report
 * looks like, so the stub must never serve production traffic.
 *
 * Set `ALLOW_PRISMA_STUB=true` to permit it locally/CI when intentionally offline.
 */
export function isPrismaClientStub(): boolean {
  return (generatedClient as Record<string, unknown>).__AGENTIX_STUB_PRISMA_CLIENT === true;
}

export function assertUsablePrismaClient(): void {
  if (!isPrismaClientStub()) return;
  const allowed = process.env.ALLOW_PRISMA_STUB === "true" || process.env.NODE_ENV !== "production";
  const logger = createLogger({ level: process.env.LOG_LEVEL ?? "info" });
  const message =
    "Prisma client is the offline stub: no query will reach PostgreSQL. Remediation: run `prisma generate` " +
    "(wired into `npm install` via postinstall) and confirm the generator output matches the import path in " +
    "src/infrastructure/persistence/prisma.ts. Set ALLOW_PRISMA_STUB=true only for offline development.";
  if (allowed) {
    logger.warn({ msg: "prisma client stub in use", detail: "queries are no-ops; set ALLOW_PRISMA_STUB=false to fail fast" });
    return;
  }
  throw new Error(message);
}

let prismaClient: generatedClient.PrismaClient | null = null;

export function createPrismaClient(): generatedClient.PrismaClient {
  assertUsablePrismaClient();
  const logger = createLogger({ level: process.env.LOG_LEVEL ?? "info" });
  const PrismaClientCtor = generatedClient.PrismaClient;

  let adapterModule: { PrismaPg: new (pool: unknown) => unknown } | null = null;
  try {
    const require = createRequire(import.meta.url);
    adapterModule = require("@prisma/adapter-pg") as { PrismaPg: new (pool: unknown) => unknown };
  } catch (e) {
    // A missing adapter is not fatal (Prisma can use its own engine), but it must be loud:
    // swallowing it previously hid misconfigured installs behind a generic failure later on.
    logger.error({ msg: "prisma driver adapter unavailable", code: (e as { code?: string }).code ?? "MODULE_NOT_FOUND" });
  }

  if (adapterModule) {
    const pool = getPgPool();
    return new PrismaClientCtor({ adapter: new adapterModule.PrismaPg(pool) } as never);
  }
  return new PrismaClientCtor();
}

export function getPrismaClient(): generatedClient.PrismaClient {
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
