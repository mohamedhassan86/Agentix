/**
 * Worker entry point - Phase 1 shell.
 */
console.log("Agentix worker starting (Phase 1 placeholder)...");

async function main() {
  console.log("Worker heartbeat: ready (no work claiming in Phase 1)");
  // Keep process alive for a moment in dev, then exit gracefully if not in watch mode
  if (process.env.NODE_ENV !== "production") {
    // In Phase 1, just exit after log to allow build checks
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
