/**
 * Worker entry point - Phase 3: startup, readiness, heartbeat, signal wiring.
 */

import { getWorkerComposition } from "./composition-root";
import { initializeTelemetry } from "@/infrastructure/observability/telemetry";

async function main() {
  const composition = getWorkerComposition();
  const { logger, readinessProbe } = composition;

  const version = process.env.npm_package_version ?? "0.1.0";

  // Initialize telemetry if configured
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

  // Validate config already done in composition creation (fail-fast)

  // Check readiness with bounded probe
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

  // Heartbeat interval
  const heartbeatInterval = setInterval(() => {
    logger.info({ msg: "worker heartbeat", version, service: "agentix-worker" });
  }, 30_000);

  // Graceful shutdown
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ msg: `worker received ${signal}, shutting down` });
    clearInterval(heartbeatInterval);

    try {
      const { disconnectPrisma } = await import("@/infrastructure/persistence/prisma");
      await disconnectPrisma();
    } catch {
      // ignore
    }

    // Give up to 30s for graceful shutdown per spec
    setTimeout(() => {
      logger.info({ msg: "worker shutdown complete" });
      process.exit(0);
    }, 100).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // In Phase 3, worker does not yet claim work - it just stays alive with heartbeat
  // Phase 4 will add coordinator loop
  logger.info({ msg: "worker running (no work claiming in Phase 3)", version });

  // Keep process alive
  if (process.env.NODE_ENV !== "production") {
    // In dev, if not in watch mode, we still keep alive but log
    // The process will be terminated by signal
  }
}

main().catch((err) => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
