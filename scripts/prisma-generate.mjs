#!/usr/bin/env node
/**
 * Resilient Prisma client generation for host builds (Vercel) and CI.
 *
 * Rationale: `src/generated/prisma/client.ts` is a committed stub so the app builds
 * without engine downloads. If the host build never generates the real client, the deploy
 * silently runs the stub. This script generates the real client when possible and warns
 * loudly - without failing the build - when it cannot (offline sandboxes, engine CDN
 * outages), exactly like the CI workflow does.
 *
 * Environment:
 * - PRISMA_GENERATE_ATTEMPTS=3   attempts before giving up
 * - PRISMA_GENERATE_REQUIRED=true fail the build when generation is impossible
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const attempts = Number(process.env.PRISMA_GENERATE_ATTEMPTS ?? 3);
const required = ["1", "true", "yes", "on"].includes(String(process.env.PRISMA_GENERATE_REQUIRED ?? "").toLowerCase());
const clientPath = "src/generated/prisma/client.ts";

function hasStubClient() {
  try {
    return /Prisma Client stub/i.test(readFileSync(clientPath, "utf-8"));
  } catch {
    return false;
  }
}

const env = {
  ...process.env,
  // Generation only needs a syntactically valid datasource URL, never a live connection.
  DATABASE_URL: process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? "postgresql://generate:generate@localhost:5432/generate",
  PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: process.env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING ?? "1",
};

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  console.log(`[prisma-generate] attempt ${attempt}/${attempts}: prisma generate`);
  const result = spawnSync("npx", ["prisma", "generate"], { stdio: "inherit", env, shell: process.platform === "win32" });

  if (result.status === 0 && !hasStubClient()) {
    console.log("[prisma-generate] Prisma client generated.");
    process.exit(0);
  }
}

const message =
  "[prisma-generate] could not generate the Prisma client (engine download or network failure).";

if (required) {
  console.error(`${message} PRISMA_GENERATE_REQUIRED=true, failing the build.`);
  process.exit(1);
}

console.warn("======================================================================");
console.warn(`${message}`);
console.warn("The build continues with src/generated/prisma/client.ts (no-op stub).");
console.warn("Database readiness is unaffected, but ORM-backed endpoints will no-op.");
console.warn("Re-run the build with network access to binaries.prisma.sh, or set");
console.warn("PRISMA_GENERATE_REQUIRED=true to make this failure explicit.");
console.warn("======================================================================");
process.exit(0);
