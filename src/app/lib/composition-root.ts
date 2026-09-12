import { Dispatcher } from "@/application/shared/dispatch/dispatcher";
import { SystemClock } from "@/application/shared/ports/clock";
import { UuidV7Generator } from "@/infrastructure/persistence/id-generator";
import { getPrismaClient } from "@/infrastructure/persistence/prisma";
import { createLogger } from "@/infrastructure/observability/logger";
import { loadConfig } from "@/infrastructure/config/load-config";

export interface AppComposition {
  dispatcher: Dispatcher;
  clock: SystemClock;
  idGenerator: UuidV7Generator;
  prisma: ReturnType<typeof getPrismaClient>;
  logger: ReturnType<typeof createLogger>;
  config: ReturnType<typeof loadConfig>;
}

let composition: AppComposition | null = null;

export function createAppComposition(): AppComposition {
  const config = loadConfig();
  const dispatcher = new Dispatcher();
  const clock = new SystemClock();
  const idGenerator = new UuidV7Generator();
  const prisma = getPrismaClient();
  const logger = createLogger({ level: config.log.level });

  return {
    dispatcher,
    clock,
    idGenerator,
    prisma,
    logger,
    config,
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
