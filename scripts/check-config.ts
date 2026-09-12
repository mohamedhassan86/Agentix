/**
 * Config check shell - validates DATABASE_URL presence.
 * Phase 1 shell; Phase 2 will implement full typed config validation.
 */
import { config } from "dotenv";
import { resolve } from "path";
import { existsSync } from "fs";

// Load environment files in order of precedence
// 1. .env.local (local development, gitignored)
// 2. .env (committed defaults, if exists)
// Only load if files exist to avoid errors in production
const envLocalPath = resolve(process.cwd(), ".env.local");
const envPath = resolve(process.cwd(), ".env");

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  config({ path: envPath });
}
// If neither exists, assume env vars are set by platform (Vercel, Railway, etc.)

const required = ["DATABASE_URL"];
const missing: string[] = [];

for (const key of required) {
  if (!process.env[key]) {
    missing.push(key);
  }
}

if (missing.length > 0) {
  console.error(`Missing required config: ${missing.join(", ")}`);
  console.error(`Remediation: set ${missing[0]} in .env.local or environment`);
  process.exit(1);
}

console.log("Config check passed");
