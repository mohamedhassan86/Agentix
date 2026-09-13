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

const env = process.env;
const first = (...names: string[]): string | undefined => {
  for (const name of names) {
    const value = env[name];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return undefined;
};

/**
 * Prisma CLI (migrate/db pull/db push) must use the DIRECT, non-pooled endpoint.
 * PgBouncer transaction pooling rejects DDL such as `CREATE TYPE` ("cannot run
 * inside a transaction block"), which is why migrations fail against the pooled
 * Vercel/Neon URL while the app itself works fine with it.
 * Runtime code resolves URLs the other way round — see
 * src/infrastructure/config/database-url.ts.
 */
const directUrl = first(
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL_UNPOOLED',
  'DIRECT_URL',
  'DATABASE_URL_DIRECT',
  'DATABASE_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL'
);

if (!directUrl) {
  console.error(
    '[prisma.config] No PostgreSQL URL found. Set one of POSTGRES_URL_NON_POOLING, ' +
      'DATABASE_URL_UNPOOLED, DATABASE_URL (Vercel Postgres injects POSTGRES_* automatically).'
  );
} else if (/pooler/i.test(directUrl) || /pgbouncer=true/i.test(directUrl)) {
  console.warn(
    '[prisma.config] Using a pooled (PgBouncer) endpoint for migrations; DDL such as CREATE TYPE ' +
      'may fail. Point the Prisma CLI at the non-pooled URL (POSTGRES_URL_NON_POOLING / DATABASE_URL_UNPOOLED).'
  );
}

// `prisma generate` / `validate` / `format` never touch the database, so they must
// not fail just because no URL is configured (e.g. a Vercel install with secrets
// scoped to runtime only).
const OFFLINE_COMMANDS = ['generate', 'validate', 'format'];
const offlineOnly = process.argv.slice(2).some((arg) => OFFLINE_COMMANDS.includes(arg));
const PLACEHOLDER_URL = 'postgresql://prisma:prisma@localhost:5432/prisma_placeholder';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    // Priority: explicit direct URL > DATABASE_URL > platform pooled URL
    url: directUrl ?? (offlineOnly ? PLACEHOLDER_URL : undefined),
  },
});
