import { Dispatcher } from "@/application/shared/dispatch/dispatcher";
import { SystemClock, type IClock } from "@/application/shared/ports/clock";
import { UuidV7Generator } from "@/infrastructure/persistence/id-generator";
import { registerIdentityAuthHandlers } from "@/application/identity/register-handlers";
import type { IdentityHandlerDeps } from "@/application/identity/ports/identity-store";
import { SessionService } from "@/infrastructure/identity/auth/session-service";
import type { AppComposition } from "@/app/lib/composition-root";
import { MemoryIdentityStore } from "./memory-identity-store";
import { TestEncryption, TestPasswordHasher, TestTokenGenerator } from "./test-crypto";
import { createLogger, createTestSink } from "@/infrastructure/observability/logger";
import { loadConfig } from "@/infrastructure/config/load-config";

export interface IdentityHarness {
  store: MemoryIdentityStore;
  deps: IdentityHandlerDeps;
  composition: AppComposition;
  clock: IClock;
}

export function createIdentityHarness(options: { clock?: IClock } = {}): IdentityHarness {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/agentix_test";
  process.env.APP_ORIGIN = process.env.APP_ORIGIN ?? "http://localhost:3000";
  (process.env as Record<string, string>).NODE_ENV = process.env.NODE_ENV ?? "test";

  const store = new MemoryIdentityStore();
  const clock = options.clock ?? new SystemClock();
  const ids = new UuidV7Generator();
  const hasher = new TestPasswordHasher();
  const tokens = new TestTokenGenerator();
  const encryption = new TestEncryption();
  const deps: IdentityHandlerDeps = {
    store,
    hasher,
    tokens,
    encryption,
    clock,
    ids,
    origin: "http://localhost:3000",
    sessionMaxAgeSeconds: 3600,
    deliveryKeyVersion: 1,
  };
  const dispatcher = new Dispatcher();
  registerIdentityAuthHandlers(dispatcher, deps);
  const sessionService = new SessionService(store, tokens, clock, 3600);
  const config = loadConfig();
  const composition = {
    dispatcher,
    clock: clock as any,
    idGenerator: ids,
    prisma: {} as any,
    logger: createLogger({ level: "error", sink: createTestSink() }),
    config,
    readinessProbe: { ready: async () => ({ ok: true }) } as any,
    sessionService,
    identityStore: store,
    identityDeps: deps,
  } as AppComposition;

  return { store, deps, composition, clock };
}
