// prisma.config.ts
import { defineConfig } from '@prisma/config';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
    // If you need directUrl for migrations, add it here:
    // directUrl: process.env.DIRECT_DATABASE_URL,
  },
});
