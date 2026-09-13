import { defineConfig } from '@prisma/config';
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// 1. Try to load .env.local (Local Development)
const envLocalPath = resolve(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
}
// 2. Fallback to .env (CI/Arena/Some Producers)
else if (existsSync(resolve(process.cwd(), '.env'))) {
  config();
}

// 3. If neither exists, we don't call config().
// Node will naturally look at process.env (Production/System variables).

/**
 * Migrations must not run through a transaction-mode pooler (port 6543): Supabase's
 * Supavisor cannot execute the session-scoped statements Prisma needs. Prefer an explicit
 * direct/session connection, then fall back to the canonical names injected by hosts:
 *   DIRECT_URL > POSTGRES_URL_NON_POOLING > DATABASE_URL > POSTGRES_PRISMA_URL > POSTGRES_URL
 */
const datasourceUrl =
  process.env.DIRECT_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL;

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: datasourceUrl,
  },
});
