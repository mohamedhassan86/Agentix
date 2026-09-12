import { metrics } from "@opentelemetry/api";
import { isAllowedMetricLabel, sanitizeAttributes } from "./telemetry";

const meter = metrics.getMeter("agentix-foundation");

export const httpDuration = meter.createHistogram("http_request_duration_seconds", {
  description: "HTTP request duration",
});

export const httpRequestsTotal = meter.createCounter("http_requests_total", {
  description: "Total HTTP requests",
});

export const httpFailuresTotal = meter.createCounter("http_failures_total", {
  description: "Total HTTP failures",
});

export const workSuccessTotal = meter.createCounter("work_success_total", {
  description: "Total successful work items",
});

export const workFailureTotal = meter.createCounter("work_failure_total", {
  description: "Total failed work items",
});

export const workRetryTotal = meter.createCounter("work_retry_total", {
  description: "Total retried work items",
});

export const outboxClaimDuration = meter.createHistogram("outbox_claim_duration_seconds", {
  description: "Outbox claim duration",
});

export const readinessState = meter.createHistogram("readiness_state", {
  description: "Readiness probe state",
});

export function recordHttpRequest(attributes: Record<string, string | number>, durationSeconds: number) {
  const safe = sanitizeAttributes(attributes as any, isAllowedMetricLabel) as Record<string, string | number>;
  httpDuration.record(durationSeconds, safe);
  httpRequestsTotal.add(1, safe);
}

export function recordHttpFailure(attributes: Record<string, string | number>) {
  const safe = sanitizeAttributes(attributes as any, isAllowedMetricLabel) as Record<string, string | number>;
  httpFailuresTotal.add(1, safe);
}

export function recordWorkOutcome(outcome: "succeeded" | "failed" | "retry", attributes: Record<string, string>) {
  const safe = sanitizeAttributes(attributes as any, isAllowedMetricLabel) as Record<string, string>;
  if (outcome === "succeeded") workSuccessTotal.add(1, safe);
  else if (outcome === "failed") workFailureTotal.add(1, safe);
  else workRetryTotal.add(1, safe);
}
