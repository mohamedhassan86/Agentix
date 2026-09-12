#!/usr/bin/env node
/**
 * OpenAPI drift check shell.
 * In Phase 1, we only ensure the committed contract exists or allow empty.
 * Later phases will implement semantic comparison.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const COMMITTED_JSON = join(ROOT, "contracts/openapi/agentix-v1.json");
const SPEC_YAML = join(ROOT, "specs/001-solution-foundation/contracts/openapi.yaml");

console.log("Checking OpenAPI contracts...");

if (!existsSync(SPEC_YAML)) {
  console.error(`Spec contract missing: ${SPEC_YAML}`);
  process.exit(1);
}

if (!existsSync(COMMITTED_JSON)) {
  console.log(`Committed OpenAPI JSON not yet generated at ${COMMITTED_JSON} - skipping drift check in Phase 1`);
  process.exit(0);
}

console.log(`Found committed contract: ${COMMITTED_JSON}`);
console.log("OpenAPI check passed (Phase 1 shell)");
process.exit(0);
