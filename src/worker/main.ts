/**
 * Worker entry point - Phase 4: startup, readiness, heartbeat, coordinator, signal wiring.
 */

import { getWorkerComposition } from "./composition-root";
import { initializeTelemetry } from "@/infrastructure/observability/telemetry";

async function main() {
  const composition = getWorkerComposition();
  const { logger, readinessProbe, coordinator } = composition;

  const version = process.env.npm_package_version ?? "0.1.0";

  try {
    await initializeTelemetry({
      serviceName: "agentix-worker",
      serviceVersion: version,
      tracesUrl: process.env.OTEL_TRACES_EXPORTER_URL,
      metricsUrl: process.env.OTEL_METRICS_EXPORTER_URL,
      enabled: true,
    });
  } catch (e) {
    logger.warn({ msg: "telemetry init failed", err: e });
  }

  logger.info({ msg: "worker starting", version, service: "agentix-worker" });

  const readiness = await readinessProbe.check();
  if (readiness.status !== "ready") {
    logger.error({
      msg: "worker readiness failed",
      dependency: readiness.dependency,
      detail: readiness.message,
    });
    console.error(`Worker readiness failed: dependency=${readiness.dependency} message=${readiness.message}`);
    process.exit(1);
  }

  logger.info({ msg: "worker ready", version });

  const heartbeatInterval = setInterval(() => {
    logger.info({ msg: "worker heartbeat", version, service: "agentix-worker" });
  }, 30_000);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ msg: `worker received ${signal}, shutting down` });
    clearInterval(heartbeatInterval);
    try {
      await coordinator.stop();
    } catch {
      void 0;
    }
    try {
      const { disconnectPrisma } = await import("@/infrastructure/persistence/prisma");
      await disconnectPrisma();
    } catch {
      void 0;
    }
    setTimeout(() => {
      logger.info({ msg: "worker shutdown complete" });
      process.exit(0);
    }, 100).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  logger.info({ msg: "worker running with coordinator", version });

  await coordinator.start();
}

main().catch((err) => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
