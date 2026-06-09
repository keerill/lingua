import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Load the monorepo-root .env regardless of the cwd the Prisma CLI runs from.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../.env') });

// Prisma 7 moved the connection URL out of schema.prisma into this config.
// Used by the Prisma CLI (migrate/generate). The runtime client connects via
// the @prisma/adapter-pg driver adapter (see prisma.service.ts).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL_VOCABULARY'),
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
