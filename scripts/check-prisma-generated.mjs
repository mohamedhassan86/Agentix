#!/usr/bin/env node
/**
 * Verifies that `prisma generate` produced a real client at the path the app imports
 * (src/generated/prisma/client.ts) instead of leaving the committed offline stub.
 *
 * Why this exists: with the legacy `prisma-client-js` provider, Prisma writes
 * index.js/runtime files, so `client.ts` kept being the stub and the deployed app
 * answered every request from the stub (findUnique -> null, create -> {}, and
 * $transaction(fn) ran fn with no transaction). Nothing failed - the database just
 * stayed empty. Run as part of `postinstall` so a bad generator config breaks the
 * build instead of the deployment.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = join(ROOT, "src", "generated", "prisma");
const CLIENT_FILE = join(GENERATED_DIR, "client.ts");
const STUB_MARKER = "__AGENTIX_STUB_PRISMA_CLIENT";

function fail(reason, hints = []) {
  console.error("\n\x1b[31m✖ prisma generate did not produce a usable client.\x1b[0m");
  console.error(`  ${reason}`);
  for (const hint of hints) console.error(`  → ${hint}`);
  if (existsSync(GENERATED_DIR)) {
    console.error(`  files in ${relative(ROOT, GENERATED_DIR)}: ${readdirSync(GENERATED_DIR).join(", ")}`);
  } else {
    console.error(`  ${relative(ROOT, GENERATED_DIR)} does not exist at all`);
  }
  process.exit(1);
}

if (!existsSync(CLIENT_FILE)) {
  fail(`${relative(ROOT, CLIENT_FILE)} is missing.`, [
    "Run `npx prisma generate` and check `output` in prisma/schema.prisma.",
    "src/infrastructure/persistence/prisma.ts imports ../../generated/prisma/client, so the generator must emit client.ts.",
  ]);
}

const content = readFileSync(CLIENT_FILE, "utf8");
if (content.includes(STUB_MARKER)) {
  const legacy = existsSync(join(GENERATED_DIR, "index.js"));
  fail(`${relative(ROOT, CLIENT_FILE)} is still the offline stub, so every query would be a no-op in production.`, [
    legacy
      ? "Detected src/generated/prisma/index.js: the schema uses the legacy `prisma-client-js` provider. Switch to provider = \"prisma-client\", which writes client.ts."
      : "Re-run `npx prisma generate`; if it fails, fix that first - do not delete this check.",
    "Only ever set ALLOW_PRISMA_STUB=true for offline development, never in a deployment.",
  ]);
}

console.log(`✔ Prisma client generated at ${relative(ROOT, CLIENT_FILE)}`);
