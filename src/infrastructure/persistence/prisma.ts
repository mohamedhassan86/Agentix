import * as generatedClient from "../../generated/prisma/client";
import { getPgPool } from "./pg";
import { createRequire } from "node:module";
import { createLogger } from "../observability/logger";

/**
 * `src/generated/prisma/client.ts` is normally a hand-written stub that lets the project
 * build offline (see .gitignore: only that file is committed). The stub resolves every
 * query to `null`/`{}` and runs `$transaction` callbacks with no transaction, so a build
 * that ships the stub answers requests "successfully" while writing nothing to the
 * database — indistinguishable from "Vercel cannot reach my DB".
 *
 * Defence in depth:
 *  1. `postinstall` runs `prisma generate` (generator provider must be `prisma-client`,
 *     which is what writes `client.ts` in the configured output dir).
 *  2. `scripts/check-prisma-generated.mjs` fails the *build* if the stub survived.
 *  3. At runtime, data access through a stub client throws instead of silently no-opping.
 *     The throw is deliberately attached to query access, not to boot: /health/live and
 *     /api/v1/ping must stay 200 so a build problem is not mistaken for an outage.
 *
 * Set `ALLOW_PRISMA_STUB=true` only for intentionally offline development/CI.
 */

/** Carries the HTTP shape so routes can answer problem+json instead of a bare 500. */
export class PrismaClientUnavailableError extends Error {
  override readonly name = "PrismaClientUnavailableError";
  readonly status = 503;
  readonly dependency = "database";
  readonly code: string;
  readonly detail: string;

  constructor(message: string, code: string, detail: string) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

const STUB_DETAIL =
  "Deployment build is incomplete: the Prisma client is still the offline stub, so a query would " +
  'be a no-op. Rebuild so that postinstall runs `prisma generate` (generator provider "prisma-client").';

const ADAPTER_DETAIL =
  "The Prisma pg driver adapter could not be loaded, so no connection pool is attached. " +
  "Reinstall dependencies (`npm ci`) - @prisma/adapter-pg and pg must both be present.";

export function isPrismaClientStub(): boolean {
  return (generatedClient as Record<string, unknown>).__AGENTIX_STUB_PRISMA_CLIENT === true;
}

/** Pure policy so the decision is testable independently of what is on disk. */
export function evaluateStubPolicy(env: { NODE_ENV?: string; ALLOW_PRISMA_STUB?: string }): "allow" | "reject" {
  if (env.ALLOW_PRISMA_STUB === "true") return "allow";
  return env.NODE_ENV === "production" ? "reject" : "allow";
}

/**
 * Model delegates (`outboxMessage`, ...) and the raw/tx entry points must never lie.
 * Prisma exposes models as lowercase own properties, so that shape is the deny rule;
 * lifecycle members stay reachable.
 */
const DATA_ACCESS = /^(?:[a-z][A-Za-z0-9_]*|\$(?:transaction|queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe|connect))$/;

/**
 * Returns `client` unchanged when it is safe, otherwise a proxy that throws on any data
 * access. Read-only plumbing (`$disconnect`, symbols, thenable interop) keeps working so
 * cleanup paths and test harnesses are unaffected.
 */
export function withStubGuard<T extends object>(client: T, mustGuard: boolean): T {
  if (!mustGuard) return client;
  const logger = createLogger({ level: process.env.LOG_LEVEL ?? "info" });
  let warned = false;
  return new Proxy(client, {
    get(target, property, receiver) {
      if (typeof property === "string" && DATA_ACCESS.test(property)) {
        if (!warned) {
          warned = true;
          logger.error({ msg: "prisma data access blocked", code: "PRISMA_CLIENT_NOT_GENERATED", property });
        }
        throw new PrismaClientUnavailableError(
          `Refusing to run ${property} against the offline Prisma stub.`,
          "PRISMA_CLIENT_NOT_GENERATED",
          STUB_DETAIL
        );
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

export function createPrismaClient(): generatedClient.PrismaClient {
  const logger = createLogger({ level: process.env.LOG_LEVEL ?? "info" });
  const guard = isPrismaClientStub() && evaluateStubPolicy(process.env) === "reject";
  if (isPrismaClientStub() && !guard) {
    logger.warn({ msg: "prisma client stub in use", detail: "queries are no-ops; offline development only" });
  }

  const PrismaClientCtor = generatedClient.PrismaClient;

  if (!isPrismaClientStub()) {
    // The pg adapter is mandatory for a v7 client (no Rust engine any more), but it is
    // only *used* by a real client; the stub ignores options entirely.
    let adapterModule: { PrismaPg: new (pool: unknown) => unknown } | null = null;
    try {
      const require = createRequire(import.meta.url);
      adapterModule = require("@prisma/adapter-pg") as { PrismaPg: new (pool: unknown) => unknown };
    } catch (e) {
      logger.error({ msg: "prisma driver adapter unavailable", code: (e as { code?: string }).code ?? "MODULE_NOT_FOUND" });
    }
    if (!adapterModule) {
      // Constructing a client without an adapter only defers the failure to the first
      // query; throw where the reason is still obvious.
      throw new PrismaClientUnavailableError("Prisma pg driver adapter could not be loaded.", "PRISMA_ADAPTER_MISSING", ADAPTER_DETAIL);
    }
    return new PrismaClientCtor({ adapter: new adapterModule.PrismaPg(getPgPool()) } as never);
  }

  // The stub ignores constructor options; a real v7 client requires an options object
  // (with an adapter), so the call is typed loosely to compile against either shape.
  return withStubGuard(new PrismaClientCtor({} as never), guard);
}

let prismaClient: generatedClient.PrismaClient | null = null;

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
