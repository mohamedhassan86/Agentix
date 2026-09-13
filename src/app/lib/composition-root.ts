import { Dispatcher } from "@/application/shared/dispatch/dispatcher";
import { SystemClock } from "@/application/shared/ports/clock";
import { UuidV7Generator } from "@/infrastructure/persistence/id-generator";
import { getPrismaClient } from "@/infrastructure/persistence/prisma";
import { createLogger } from "@/infrastructure/observability/logger";
import { loadConfig, type AppConfig } from "@/infrastructure/config/load-config";
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
  prisma: ReturnType<typeof getPrismaClient> | null;
  logger: ReturnType<typeof createLogger>;
  config: AppConfig | null;
  readinessProbe: MigrationReadinessProbe | null;
}

let composition: AppComposition | null = null;

export function createAppComposition(): AppComposition {
  const dispatcher = new Dispatcher();
  const clock = new SystemClock();
  const idGenerator = new UuidV7Generator();
  const version = process.env.npm_package_version ?? "0.1.0";

  let config: AppConfig;
  try {
    config = loadConfig();
  } catch (error) {
    // A serverless host cannot "fail to start": the function boots per request. Keep the
    // process-only endpoints (liveness, ping) working and let every database-backed route
    // answer 503 Problem Details with the configuration failure - instead of the whole host
    // returning an opaque 500 that hides the missing setting.
    const logger = createLogger({ level: (process.env.LOG_LEVEL as "info") ?? "info" });
    logger.error({ err: { name: error instanceof Error ? error.name : "ConfigError" }, code: "CONFIG_INVALID" });

    const failingHandler = {
      handle: async (): Promise<never> => {
        throw error;
      },
    };

    dispatcher.register(GET_LIVENESS_TYPE, { handle: createLivenessHandler(version) } as never);
    dispatcher.register(GET_PING_TYPE, { handle: createPingHandler(version) } as never);
    dispatcher.register(GET_READINESS_TYPE, failingHandler as never);
    dispatcher.register(CREATE_FOUNDATION_WORK_TYPE, failingHandler as never);
    dispatcher.register(GET_FOUNDATION_WORK_TYPE, failingHandler as never);

    return {
      dispatcher,
      clock,
      idGenerator,
      prisma: null,
      logger,
      config: null,
      readinessProbe: null,
    };
  }

  const prisma = getPrismaClient();
  const logger = createLogger({ level: config.log.level });
  const readinessProbe = new MigrationReadinessProbe();
  const demoRepository = new FoundationDemoRepository(prisma as never);

  const workDeps = {
    demoRepository,
    config: {
      app: { env: config.app.env as never, origin: config.app.origin ?? undefined },
      foundation: { demoEnabled: config.foundation.demoEnabled },
    },
  };

  dispatcher.register(GET_LIVENESS_TYPE, { handle: createLivenessHandler(version) } as never);
  dispatcher.register(GET_READINESS_TYPE, { handle: createReadinessHandler(version, readinessProbe) } as never);
  dispatcher.register(GET_PING_TYPE, { handle: createPingHandler(version) } as never);
  dispatcher.register(CREATE_FOUNDATION_WORK_TYPE, { handle: createFoundationWorkHandler(workDeps) } as never);
  dispatcher.register(GET_FOUNDATION_WORK_TYPE, { handle: getFoundationWorkHandler(workDeps) } as never);

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
