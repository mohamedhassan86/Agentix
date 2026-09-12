import { loadConfig } from "@/infrastructure/config/load-config";
import { createLogger } from "@/infrastructure/observability/logger";
import { SystemClock } from "@/application/shared/ports/clock";
import { UuidV7Generator } from "@/infrastructure/persistence/id-generator";
import { getPrismaClient } from "@/infrastructure/persistence/prisma";
import { MigrationReadinessProbe } from "@/infrastructure/persistence/migration-readiness";
import { Dispatcher } from "@/application/shared/dispatch/dispatcher";
import { WorkHandlerRegistry } from "@/application/shared/work/work-handler-registry";
import { foundationDemoHandler, FOUNDATION_DEMO_WORK_TYPE, FOUNDATION_DEMO_SCHEMA_VERSION } from "./handlers/foundation-demo-handler";
import { WorkerCoordinator } from "@/infrastructure/work/worker-coordinator";
import { v7 as uuidv7 } from "uuid";

export interface WorkerComposition {
  config: ReturnType<typeof loadConfig>;
  logger: ReturnType<typeof createLogger>;
  clock: SystemClock;
  idGenerator: UuidV7Generator;
  prisma: ReturnType<typeof getPrismaClient>;
  readinessProbe: MigrationReadinessProbe;
  dispatcher: Dispatcher;
  workRegistry: WorkHandlerRegistry;
  coordinator: WorkerCoordinator;
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
  const workRegistry = new WorkHandlerRegistry();

  workRegistry.register(FOUNDATION_DEMO_WORK_TYPE, FOUNDATION_DEMO_SCHEMA_VERSION, foundationDemoHandler);

  const coordinator = new WorkerCoordinator({
    workerId: `worker-${uuidv7().slice(0, 8)}`,
    pollIntervalMs: 1000,
    batchSize: 10,
    leaseDurationMs: 30_000,
    maxAttempts: 3,
    registry: workRegistry,
  });

  return {
    config,
    logger,
    clock,
    idGenerator,
    prisma,
    readinessProbe,
    dispatcher,
    workRegistry,
    coordinator,
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
