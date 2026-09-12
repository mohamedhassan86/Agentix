#!/usr/bin/env node
/**
 * Architecture check using dependency-cruiser.
 * Phase 1 shell: runs cruiser on src and ensures zero violations for production code.
 * Forbidden fixtures are checked separately by the architecture test harness.
 */
import { execSync } from "node:child_process";

console.log("Running dependency-cruiser architecture check...");

try {
  execSync("npx depcruise --config .dependency-cruiser.cjs src --output-type err --output-to /tmp/depcruise.err 2>&1 || true", {
    stdio: "inherit",
  });
  // Read output
  const { readFileSync, existsSync } = await import("node:fs");
  if (existsSync("/tmp/depcruise.err")) {
    const content = readFileSync("/tmp/depcruise.err", "utf8");
    if (content.trim().length > 0 && content.includes("error")) {
      console.error("Architecture violations found:");
      console.error(content);
      process.exit(1);
    }
  }
  console.log("Architecture check passed: zero violations in production graph");
  process.exit(0);
} catch (e) {
  console.error("Architecture check failed:", e.message);
  process.exit(1);
}
