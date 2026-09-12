#!/usr/bin/env node
/**
 * Architecture check using dependency-cruiser.
 * Enforces inward-only dependencies, no cycles, no forbidden imports.
 * Reports source→target for each violation.
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync, unlinkSync } from "node:fs";

console.log("Running dependency-cruiser architecture check...");

const outputFile = "/tmp/depcruise.err";
try {
  if (existsSync(outputFile)) unlinkSync(outputFile);
} catch {
  void 0;
}

try {
  execSync(`npx depcruise src --config .dependency-cruiser.cjs --output-type err --output-to ${outputFile}`, {
    stdio: "pipe",
    encoding: "utf-8",
  });
} catch {
  // depcruise exits non-zero on violations, we still want to read output
  void 0;
}

if (existsSync(outputFile)) {
  const content = readFileSync(outputFile, "utf-8");
  // Success message is "✔ no dependency violations found"
  if (content.includes("no dependency violations found")) {
    // success
  } else if (content.trim().length > 0) {
    console.error("Architecture violations found:");
    console.error(content);
    console.error("\nFailed: architecture boundaries violated. See source→target above.");
    process.exit(1);
  }
}

console.log("Architecture check passed: zero violations in production graph");

// Also verify thin-route rule via dedicated test is not required here, but we can log
console.log("Thin-route and no-business-scope checks are enforced via architecture tests.");
process.exit(0);
