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

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    // Priority: System Env > .env.local > .env
    url: process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL,
  },
});
