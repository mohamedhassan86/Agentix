/**
 * Config check shell - validates the database configuration and reports how the runtime pool
 * will secure it (names and modes only, never values).
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

// Any one of these satisfies the database requirement: hosts and the Supabase <-> Vercel
// integration inject different names for the same secret (see src/infrastructure/config/database-url.ts).
const acceptedDatabaseKeys = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL", "SUPABASE_DB_URL"];
const databaseKey = acceptedDatabaseKeys.find((key) => (process.env[key] ?? "").trim().length > 0);

if (!databaseKey) {
  console.error(`Missing required config: ${acceptedDatabaseKeys[0]}`);
  console.error(`Accepted alternative names: ${acceptedDatabaseKeys.slice(1).join(", ")}`);
  console.error(`Remediation: set ${acceptedDatabaseKeys[0]} in .env.local or environment`);
  process.exit(1);
}

const { describePgPoolSecurity } = await import("../src/infrastructure/persistence/pg");
const security = describePgPoolSecurity();
if (security) {
  // Names and modes only: never the host, the user, or the credential.
  console.log(`Config check passed (connection string from ${security.source}, tls=${security.sslMode} from ${security.sslSource})`);
} else {
  console.log(`Config check passed (connection string from ${databaseKey})`);
}
