import { Dispatcher } from "@/application/shared/dispatch/dispatcher";
import { SystemClock } from "@/application/shared/ports/clock";
import { UuidV7Generator } from "@/infrastructure/persistence/id-generator";
import { getPrismaClient } from "@/infrastructure/persistence/prisma";
import { createLogger } from "@/infrastructure/observability/logger";
import { loadConfig } from "@/infrastructure/config/load-config";
import { createLivenessHandler, createReadinessHandler } from "@/application/foundation/handlers/health";
import { createPingHandler } from "@/application/foundation/handlers/ping";
import { GET_LIVENESS_TYPE, GET_READINESS_TYPE } from "@/application/foundation/queries/health";
import { GET_PING_TYPE } from "@/application/foundation/queries/ping";
import { MigrationReadinessProbe } from "@/infrastructure/persistence/migration-readiness";
import { CREATE_FOUNDATION_WORK_TYPE } from "@/application/foundation/commands/work";
import { GET_FOUNDATION_WORK_TYPE } from "@/application/foundation/queries/work";
import { createFoundationWorkHandler, getFoundationWorkHandler } from "@/application/foundation/handlers/work";
import { FoundationDemoRepository } from "@/infrastructure/persistence/foundation-demo-repository";

export interface AppComposition {
  dispatcher: Dispatcher;
  clock: SystemClock;
  idGenerator: UuidV7Generator;
  prisma: ReturnType<typeof getPrismaClient>;
  logger: ReturnType<typeof createLogger>;
  config: ReturnType<typeof loadConfig>;
  readinessProbe: MigrationReadinessProbe;
}

let composition: AppComposition | null = null;

export function createAppComposition(): AppComposition {
  const config = loadConfig();
  const dispatcher = new Dispatcher();
  const clock = new SystemClock();
  const idGenerator = new UuidV7Generator();
  const prisma = getPrismaClient();
  const logger = createLogger({ level: config.log.level });
  const readinessProbe = new MigrationReadinessProbe();
  const demoRepository = new FoundationDemoRepository(prisma as any);

  const version = process.env.npm_package_version ?? "0.1.0";

  const workDeps = {
    demoRepository,
    config: {
      app: { env: config.app.env as any, origin: config.app.origin ?? undefined },
      foundation: { demoEnabled: config.foundation.demoEnabled },
    },
  };

  dispatcher.register(GET_LIVENESS_TYPE, { handle: createLivenessHandler(version) } as any);
  dispatcher.register(GET_READINESS_TYPE, { handle: createReadinessHandler(version, readinessProbe) } as any);
  dispatcher.register(GET_PING_TYPE, { handle: createPingHandler(version) } as any);
  dispatcher.register(CREATE_FOUNDATION_WORK_TYPE, { handle: createFoundationWorkHandler(workDeps) } as any);
  dispatcher.register(GET_FOUNDATION_WORK_TYPE, { handle: getFoundationWorkHandler(workDeps) } as any);

  return {
    dispatcher,
    clock,
    idGenerator,
    prisma,
    logger,
    config,
    readinessProbe,
  };
}

export function getAppComposition(): AppComposition {
  if (!composition) {
    composition = createAppComposition();
  }
  return composition;
}

export function clearAppComposition(): void {
  composition = null;
}
