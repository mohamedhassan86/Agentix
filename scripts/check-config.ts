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

const {
  APP_URL_ENV_VARS,
  describeDatabaseUrls,
  resolveDatabaseUrls,
} = await import("../src/infrastructure/config/database-url");

const missing: string[] = [];

if (!APP_URL_ENV_VARS.some((key: string) => !!process.env[key])) {
  missing.push("DATABASE_URL");
}
if (!process.env.APP_ORIGIN && process.env.NODE_ENV === "production") {
  missing.push("APP_ORIGIN");
}

if (missing.length > 0) {
  console.error(`Missing required config: ${missing.join(", ")}`);
  console.error(
    `Remediation: set ${missing[0]} in .env.local or in the platform environment ` +
      `(Vercel: Project -> Settings -> Environment Variables). ` +
      `Accepted Postgres vars: ${APP_URL_ENV_VARS.join(", ")}`
  );
  process.exit(1);
}

try {
  const info = describeDatabaseUrls(resolveDatabaseUrls(process.env));
  console.log(`Database URL resolved from ${info.source} (pooler=${info.usesPooler}) -> ${info.redacted}`);
  if (!info.hasDirectUrl) {
    console.warn(
      "WARN: no non-pooled endpoint found (POSTGRES_URL_NON_POOLING / DATABASE_URL_UNPOOLED); " +
        "prisma migrate deploy needs one when the app URL points at a pooler."
    );
  }
} catch (e) {
  console.error(`Config check failed: ${(e as Error).message}`);
  process.exit(1);
}

console.log("Config check passed");
