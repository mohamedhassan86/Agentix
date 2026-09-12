/**
 * Next.js instrumentation hook for OpenTelemetry.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeTelemetry } = await import("./infrastructure/observability/telemetry");
    const version = process.env.npm_package_version ?? "0.1.0";
    await initializeTelemetry({
      serviceName: "agentix-web",
      serviceVersion: version,
      tracesUrl: process.env.OTEL_TRACES_EXPORTER_URL,
      metricsUrl: process.env.OTEL_METRICS_EXPORTER_URL,
      enabled: true,
    });
  }
}
