# 04 — Data: Prisma, Postgres, and friends

Lingua stores its persistent data in **PostgreSQL**, accessed through **Prisma** — a TypeScript
ORM. Each service owns its **own database** (database-per-service). Audio files live in
**MinIO** (an S3-compatible object store), and **Redis** is wired into configuration but not
yet consumed by application code.

This doc explains what an ORM is, what Prisma gives you, why we split databases per service,
and the specifics of how this repo configures Prisma 7.

## What is it

### What is an ORM?

A database speaks SQL and returns rows. Your application speaks objects. An **Object-Relational
Mapper (ORM)** sits in between: you describe your tables once, and the ORM gives you typed
functions to read and write rows as objects, generating the SQL for you. Benefits: fewer
hand-written SQL strings, compile-time type safety, and managed schema changes (*migrations*).

### What is Prisma?

[Prisma](https://www.prisma.io/) is an ORM built for TypeScript. It has three moving parts:

| Part | What it is |
|---|---|
| **Schema** (`schema.prisma`) | A declarative file describing your models (tables), fields, indexes and relations. The single source of truth for the database shape. |
| **Client** | Generated TypeScript code (from the schema) that you import and call — `prisma.cardSchedule.findUnique(...)` — fully typed. |
| **Migrations** | Timestamped SQL files Prisma derives from schema changes, so the database can be evolved reproducibly across environments. |

A typical Prisma schema model from
[`apps/svc-learning/prisma/schema.prisma`](../apps/svc-learning/prisma/schema.prisma):

```prisma
model CardSchedule {
  userId        String   @map("user_id")
  cardId        String   @map("card_id")
  stability     Float
  difficulty    Float
  due           DateTime
  // ...
  @@id([userId, cardId])
  @@index([userId, due])
  @@map("card_schedules")   // the table is snake_case; the TS model is camelCase
}
```

`@map`/`@@map` keep database columns/tables snake_case while the generated TypeScript stays
camelCase.

### Database-per-service, and why

Each microservice owns a **separate** logical database and is the *only* thing allowed to read
or write it. No service reaches into another's tables.

```
                 one Postgres server (in dev: one container)
   ┌──────────────────────────────────────────────────────────────────┐
   │  identity   vocabulary   learning   dialog   content   progress   │  + notifications
   └──────────────────────────────────────────────────────────────────┘
        ▲            ▲           ▲          ▲         ▲          ▲
   svc-identity  svc-vocab.  svc-learning  svc-ai-  svc-content svc-progress  svc-notifications
                                           dialog
```

Why bother?

- **Loose coupling.** A service can change its schema freely; nobody else breaks.
- **Independent deploys & scaling.** Each service evolves and migrates on its own clock.
- **Clear ownership.** Cross-service data is shared via **events** (Kafka), not shared tables.

In local development all logical databases live inside one Postgres container for convenience;
in production they can be separate managed databases. The connection strings differ per service
via `DATABASE_URL_*` env vars.

## How Lingua uses it

### Seven service databases

Exactly **seven** services own a Prisma database. Each has a `prisma/schema.prisma`, a
`prisma.config.ts`, and a `DATABASE_URL_*` env var:

| Service | Database | Env var | Key models |
|---|---|---|---|
| svc-identity | `identity` | `DATABASE_URL_IDENTITY` | `User` |
| svc-vocabulary | `vocabulary` | `DATABASE_URL_VOCABULARY` | `Deck`, `Card`, `Outbox` |
| svc-learning | `learning` | `DATABASE_URL_LEARNING` | `CardSchedule`, `ReviewLog`, `Outbox` |
| svc-ai-dialog | `dialog` | `DATABASE_URL_DIALOG` | `DialogSession`, `DialogTurn`, `Outbox` |
| svc-content | `content` | `DATABASE_URL_CONTENT` | `Scenario`, `Lesson`, `DeckTemplate`, `Outbox` |
| svc-progress | `progress` | `DATABASE_URL_PROGRESS` | `ProcessedEvent`, `CardState`, `DailyActivity`, `PronunciationDaily` |
| svc-notifications | `notifications` | `DATABASE_URL_NOTIFICATIONS` | `UserActivity`, `Notification`, `Outbox` |

(svc-speech has no relational database — it stores audio in MinIO; see below. The frontends,
`gateway-bff`, and `web-public` have no database.)

Most write-side services include an `Outbox` table — the transactional outbox used to publish
Kafka events atomically with the business write (see [05 — Messaging](./05-messaging-kafka.md)).
`svc-progress` is a read-model: it consumes events and uses `ProcessedEvent` for idempotent
deduplication.

### Prisma 7 specifics in this repo

Three things are worth understanding because they differ from older Prisma setups:

**1. The `prisma-client` generator emits into `src/generated/prisma`.**
Instead of injecting a client into `node_modules/.prisma`, the schema generates real source
files inside the service. From every schema's generator block:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
```

These generated files (e.g.
[`apps/svc-learning/src/generated/prisma/client.ts`](../apps/svc-learning/src/generated/prisma/client.ts))
are committed and carry a `Do not edit directly` banner. They compile alongside the service.

**2. The Postgres driver adapter `@prisma/adapter-pg`.**
The connection is created explicitly with a driver adapter rather than Prisma's bundled engine
binary. The Nest `PrismaService` extends the generated `PrismaClient` and passes a `PrismaPg`
adapter built from the env var — from
[`apps/svc-learning/src/infrastructure/prisma/prisma.service.ts`](../apps/svc-learning/src/infrastructure/prisma/prisma.service.ts):

```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL_LEARNING;
    if (!connectionString) throw new Error('DATABASE_URL_LEARNING is not set');
    super({ adapter: new PrismaPg({ connectionString }) });
  }
  async onModuleInit()    { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

`PrismaService` is a normal Nest provider, so repository adapters inject it and call typed
methods — see
[`schedule.prisma-repository.ts`](../apps/svc-learning/src/infrastructure/prisma/schedule.prisma-repository.ts),
which implements the `ScheduleRepository` **port** from [03 — Backend](./03-backend-nestjs.md).
These repository classes are hand-written adapters that *use* the generated client; only the
client itself is generated.

**3. Connection strings live in `prisma.config.ts`, not in the schema.**
The schema's `datasource` block declares only the provider; the actual URL is supplied by
[`prisma.config.ts`](../apps/svc-learning/prisma.config.ts), which loads the root `.env` and
reads the per-service env var. This is what the Prisma CLI (`migrate`, `generate`) uses:

```ts
import { defineConfig, env } from 'prisma/config';
loadEnv({ path: resolve(here, '../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: env('DATABASE_URL_LEARNING') },
  migrations: { path: 'prisma/migrations' },
});
```

So there are two ways the URL is consumed: the **CLI** reads it from `prisma.config.ts`, and the
**running service** reads the same env var directly in `PrismaService`.

### Migrations

A migration is a versioned SQL change set. Prisma compares the schema to the current database
and writes the diff into a timestamped folder under `prisma/migrations/`. For example
svc-learning has:

```
apps/svc-learning/prisma/migrations/
├── 20260609131422_init/
├── 20260610120000_outbox_trace_headers/
└── migration_lock.toml
```

| Command | When | What it does |
|---|---|---|
| `prisma migrate dev` | local development | Generate a new migration from schema changes, apply it, regenerate the client. |
| `prisma migrate deploy` | CI / production | Apply already-committed migrations only — never generates new ones. |
| `prisma generate` | after schema/dep changes | (Re)create the typed client in `src/generated/prisma`. |

In containers, migrations are run by a shared **migrator** image (Prisma CLI) as an init step
before the service starts — see [11 — Docker](./11-docker.md) and
[12 — Kubernetes & Helm](./12-kubernetes-helm.md).

### Per-service Nx targets

Each Prisma-owning service exposes Nx targets in its `project.json`. From
[`apps/svc-learning/project.json`](../apps/svc-learning/project.json):

```jsonc
"prisma-generate": { "command": "prisma generate" },          // regenerate the client
"prisma-migrate":  { "command": "prisma migrate dev" },       // create + apply a migration
```

Services that ship seed data additionally have **`prisma-seed`**. Today that is **svc-content**
(it seeds the starter conversation scenarios). From
[`apps/svc-content/project.json`](../apps/svc-content/project.json):

```jsonc
"prisma-seed": {
  "command": "node --env-file=../../.env -r @swc-node/register prisma/seed.ts"
}
```

The seed script ([`apps/svc-content/prisma/seed.ts`](../apps/svc-content/prisma/seed.ts)) runs
through SWC (the same `@swc-node/register` used for `serve`).

## The other data stores

### MinIO — audio object store

Generated speech (TTS) and uploaded audio are binary blobs, not relational data, so they go to
**MinIO**, an S3-compatible object store. `svc-speech` writes WAV files through the `AudioStore`
port, implemented by
[`apps/svc-speech/src/infrastructure/store/minio-audio.store.ts`](../apps/svc-speech/src/infrastructure/store/minio-audio.store.ts)
(using the `minio` client). It uploads to a bucket and returns a playable URL:

```ts
await this.client.putObject(this.bucket, objectKey, data, data.length,
  { 'Content-Type': 'audio/wav' });
return { objectKey, url: `${this.publicUrl}/${this.bucket}/${objectKey}` };
```

Configuration comes from the `MINIO_*` env vars in [`.env.example`](../.env.example):
`MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` (`lingua-audio`),
`MINIO_PUBLIC_URL`, `MINIO_SECURE`. More in [10 — AI & Speech](./10-ai-speech.md).

### Redis — reserved, not yet consumed

`REDIS_URL` is defined in [`.env.example`](../.env.example) (`redis://localhost:6379`) and a
Redis container is part of the dev/infra stack, but **no application code consumes it yet** —
there is no Redis client dependency or usage in `apps/` or `libs/`. It is reserved for a future
caching / rate-limiting / session concern. Treat its presence in config as forward-looking, not
load-bearing.

## Key files

| File | Role |
|---|---|
| [apps/svc-learning/prisma/schema.prisma](../apps/svc-learning/prisma/schema.prisma) | Example schema: models, indexes, `prisma-client` generator. |
| [apps/svc-ai-dialog/prisma/schema.prisma](../apps/svc-ai-dialog/prisma/schema.prisma) | Schema with a relation (`DialogSession` ↔ `DialogTurn`). |
| [apps/svc-learning/prisma.config.ts](../apps/svc-learning/prisma.config.ts) | Where the connection URL + migrations path are configured for the CLI. |
| [apps/svc-learning/src/infrastructure/prisma/prisma.service.ts](../apps/svc-learning/src/infrastructure/prisma/prisma.service.ts) | Nest provider wrapping `PrismaClient` + `@prisma/adapter-pg`. |
| [apps/svc-learning/src/infrastructure/prisma/schedule.prisma-repository.ts](../apps/svc-learning/src/infrastructure/prisma/schedule.prisma-repository.ts) | Hand-written repository adapter using the generated client. |
| [apps/svc-learning/src/generated/prisma/client.ts](../apps/svc-learning/src/generated/prisma/client.ts) | The generated, committed Prisma client. |
| [apps/svc-learning/project.json](../apps/svc-learning/project.json) | `prisma-generate` / `prisma-migrate` targets. |
| [apps/svc-content/project.json](../apps/svc-content/project.json) | Adds the `prisma-seed` target. |
| [apps/svc-content/prisma/seed.ts](../apps/svc-content/prisma/seed.ts) | Seed script (starter scenarios). |
| [apps/svc-speech/src/infrastructure/store/minio-audio.store.ts](../apps/svc-speech/src/infrastructure/store/minio-audio.store.ts) | MinIO `AudioStore` adapter. |
| [.env.example](../.env.example) | `DATABASE_URL_*`, `MINIO_*`, `REDIS_URL`. |

Versions pinned in [package.json](../package.json): `prisma`, `@prisma/client`,
`@prisma/adapter-pg` all `7.8.0`; `minio` `^8.0.7`; PostgreSQL 17/18; Node `>=24`.

## See it in action

From the repo root, with the dev infra and a `.env` in place (see [QUICKSTART](./QUICKSTART.md)):

```bash
# 1. copy env defaults
cp .env.example .env

# 2. start Postgres / Kafka / MinIO / etc.
docker compose -f infra/docker/docker-compose.dev.yml up -d

# 3. apply migrations + regenerate the client for one service
pnpm nx prisma-migrate svc-learning
pnpm nx prisma-generate svc-learning

# 4. seed starter content (the one service with a seed target)
pnpm nx prisma-seed svc-content

# 5. inspect the data visually (opens Prisma Studio for that schema)
cd apps/svc-learning && pnpm prisma studio
```

Each `prisma-*` target runs inside the service folder, so it picks up that service's
`prisma.config.ts` and the matching `DATABASE_URL_*`. Run them per service as needed.

## Related

- [01 — Architecture](./01-architecture.md) — service boundaries and data ownership.
- [03 — Backend: NestJS](./03-backend-nestjs.md) — repositories are infrastructure adapters behind ports.
- [05 — Messaging: Kafka](./05-messaging-kafka.md) — the `Outbox` tables and the relay.
- [10 — AI & Speech](./10-ai-speech.md) — MinIO audio storage in depth.
- [11 — Docker](./11-docker.md) / [12 — Kubernetes & Helm](./12-kubernetes-helm.md) — the migrator job.

External:
- Prisma docs — https://www.prisma.io/docs
- Prisma driver adapters (`@prisma/adapter-pg`) — https://www.prisma.io/docs/orm/overview/databases/postgresql
- Database-per-service pattern — https://microservices.io/patterns/data/database-per-service.html
- MinIO — https://min.io/docs/minio/linux/developers/javascript/API.html
