/**
 * OpenTelemetry bootstrap and bounded metric/span attributes
 */

const ALLOWED_METRIC_LABELS = new Set([
  "operation",
  "status",
  "service",
  "dependency",
  "outcome",
  "work_type",
  "method",
  "route",
]);

const ALLOWED_SPAN_ATTRIBUTES = new Set([
  "operation",
  "service",
  "status",
  "dependency",
  "work_type",
  "correlation_id",
  "work_id",
  "org_id",
  "attempt",
  "worker_id",
  "http.method",
  "http.route",
  "http.status_code",
  "db.system",
  "db.operation",
]);

const DISALLOWED_METRIC_LABELS = new Set([
  "correlation_id",
  "work_id",
  "payload",
  "error_detail",
  "user_id",
  "email",
  "org_id",
  "project_id",
  "run_id",
  "trace_id",
  "idempotency_key",
]);

export function isAllowedMetricLabel(label: string): boolean {
  const lower = label.toLowerCase();
  if (DISALLOWED_METRIC_LABELS.has(lower)) return false;
  if (lower.includes("correlation") || lower.includes("work_id") || lower.includes("payload") || lower.includes("error")) {
    if (ALLOWED_METRIC_LABELS.has(lower)) return true;
    return false;
  }
  return ALLOWED_METRIC_LABELS.has(lower);
}

export function isAllowedSpanAttribute(attr: string): boolean {
  const lower = attr.toLowerCase();
  if (
    lower.includes("password") ||
    lower.includes("authorization") ||
    lower.includes("cookie") ||
    lower.includes("secret") ||
    (lower.includes("payload") && !lower.includes("payload_size"))
  ) {
    return false;
  }
  if (ALLOWED_SPAN_ATTRIBUTES.has(lower)) return true;
  if (lower.startsWith("http.") || lower.startsWith("db.") || lower.startsWith("work_") || lower.startsWith("correlation")) {
    if (lower === "correlation_id") return true;
    if (lower.startsWith("work_")) return true;
    if (lower.startsWith("http.")) return true;
    if (lower.startsWith("db.")) return true;
  }
  return false;
}

export function sanitizeAttributes(
  attrs: Record<string, unknown>,
  allowFn: (key: string) => boolean
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (allowFn(k)) {
      result[k] = v;
    }
  }
  return result;
}

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  tracesUrl?: string;
  metricsUrl?: string;
  enabled?: boolean;
}

let telemetryInitialized = false;

export async function initializeTelemetry(config: TelemetryConfig): Promise<void> {
  if (telemetryInitialized) return;
  if (config.enabled === false) return;
  if (!config.tracesUrl && !config.metricsUrl) {
    telemetryInitialized = true;
    return;
  }

  try {
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
    const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
    const { OTLPMetricExporter } = await import("@opentelemetry/exporter-metrics-otlp-http");
    const { resourceFromAttributes } = await import("@opentelemetry/resources");
    const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import("@opentelemetry/semantic-conventions");

    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion,
    });

    const sdk = new NodeSDK({
      resource,
      traceExporter: config.tracesUrl ? new OTLPTraceExporter({ url: config.tracesUrl }) : undefined,
      metricReader: config.metricsUrl
        ? new (await import("@opentelemetry/sdk-metrics")).PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({ url: config.metricsUrl }),
          })
        : undefined,
      instrumentations: [getNodeAutoInstrumentations()],
    });

    await sdk.start();
    telemetryInitialized = true;

    const shutdown = async () => {
      try {
        await sdk.shutdown();
      } catch {
        void 0;
      }
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (e) {
    console.warn("Failed to initialize telemetry", e);
    telemetryInitialized = true;
  }
}

export function isTelemetryInitialized(): boolean {
  return telemetryInitialized;
}
