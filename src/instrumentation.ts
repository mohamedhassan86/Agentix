/**
 * Next.js instrumentation hook for OpenTelemetry.
 * Phase 1 shell - no-op.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Telemetry will be initialized in Phase 2
  }
}
