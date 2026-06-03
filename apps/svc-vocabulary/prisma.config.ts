import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL_VOCABULARY'),
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
