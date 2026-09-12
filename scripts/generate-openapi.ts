/**
 * OpenAPI generation shell.
 * Phase 1: placeholder that copies spec YAML to JSON if needed or creates empty.
 * Later phases will implement Zod -> OpenAPI generation.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "contracts/openapi");
const OUT_FILE = join(OUT_DIR, "agentix-v1.json");
const SPEC_YAML = join(ROOT, "specs/001-solution-foundation/contracts/openapi.yaml");

console.log("Generating OpenAPI...");

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

if (!existsSync(SPEC_YAML)) {
  console.error(`Spec YAML not found: ${SPEC_YAML}`);
  process.exit(1);
}

// In Phase 1, create a minimal JSON placeholder that matches the YAML structure minimally
// Later phases will generate from Zod schemas.
const placeholder = {
  openapi: "3.1.0",
  info: {
    title: "Agentix Foundation API",
    version: "0.1.0",
    description: "Foundation-only contract",
  },
  paths: {},
};

writeFileSync(OUT_FILE, JSON.stringify(placeholder, null, 2));
console.log(`OpenAPI generated (placeholder) at ${OUT_FILE}`);
