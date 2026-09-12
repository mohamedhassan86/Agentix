import { loadConfig } from "@/infrastructure/config/load-config";
import { createLogger } from "@/infrastructure/observability/logger";
import { SystemClock } from "@/application/shared/ports/clock";
import { UuidV7Generator } from "@/infrastructure/persistence/id-generator";
import { getPrismaClient } from "@/infrastructure/persistence/prisma";
import { MigrationReadinessProbe } from "@/infrastructure/persistence/migration-readiness";
import { Dispatcher } from "@/application/shared/dispatch/dispatcher";

export interface WorkerComposition {
  config: ReturnType<typeof loadConfig>;
  logger: ReturnType<typeof createLogger>;
  clock: SystemClock;
  idGenerator: UuidV7Generator;
  prisma: ReturnType<typeof getPrismaClient>;
  readinessProbe: MigrationReadinessProbe;
  dispatcher: Dispatcher;
}

let workerComposition: WorkerComposition | null = null;

export function createWorkerComposition(): WorkerComposition {
  const config = loadConfig();
  const logger = createLogger({ level: config.log.level });
  const clock = new SystemClock();
  const idGenerator = new UuidV7Generator();
  const prisma = getPrismaClient();
  const readinessProbe = new MigrationReadinessProbe();
  const dispatcher = new Dispatcher();

  return {
    config,
    logger,
    clock,
    idGenerator,
    prisma,
    readinessProbe,
    dispatcher,
  };
}

export function getWorkerComposition(): WorkerComposition {
  if (!workerComposition) {
    workerComposition = createWorkerComposition();
  }
  return workerComposition;
}

export function clearWorkerComposition(): void {
  workerComposition = null;
}
