# 11 — Docker & Docker Compose

This document explains, from first principles, how Lingua packages each service into a
shippable artifact (a **Docker image**) and how it runs all the supporting infrastructure
(databases, message broker, auth server, object store) on your laptop with **Docker
Compose**. No prior Docker knowledge is assumed.

## What is it

**The problem Docker solves.** "It works on my machine" is the oldest bug in software. An
app needs a specific version of Node, some system libraries, certain files in certain
places, and a pile of environment variables. Reproducing that exactly on another machine
(a colleague's laptop, a CI runner, a production server) is painful. Docker solves this by
packaging the app *together with* everything it needs to run into one sealed unit.

**Image vs. container.** Two words you must not confuse:

- An **image** is a frozen, read-only template — a snapshot of a filesystem plus a
  command to run. Think of it like a class in programming, or an `.iso` file. It does
  nothing on its own; it just sits there.
- A **container** is a *running instance* of an image — like an object created from a
  class. You can start many containers from the same image. Each gets its own isolated
  filesystem, network, and processes, but they all start from the identical image
  snapshot.

You **build** an image once, then **run** it as a container as many times as you like.

**The Dockerfile.** An image is built from a `Dockerfile` — a recipe, read top to bottom.
Each instruction (`FROM`, `RUN`, `COPY`, `ENV`, `CMD`) produces a new **layer**: a diff on
top of the previous filesystem state. Common instructions:

- `FROM image` — start from an existing base image (e.g. `node:24-slim`).
- `RUN command` — execute a shell command at build time (install packages, compile code).
- `COPY src dest` — copy files from your project into the image.
- `ENV KEY=value` — set an environment variable.
- `WORKDIR /path` — set the working directory for later instructions.
- `USER name` — drop to a non-root user.
- `CMD ["...", "..."]` — the default command run when a container starts.

**Layers and caching.** Because each instruction is a layer, Docker caches them. If you
rebuild and nothing above a given line changed, Docker reuses the cached layer instead of
redoing the work. This is why Dockerfiles copy the dependency manifest and install
dependencies *before* copying the rest of the source: source changes constantly, but
dependencies change rarely, so the slow `install` layer stays cached across edits. You can
see this pattern in every Lingua Dockerfile:

```dockerfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch          # this slow layer survives source edits
COPY . .                # only this layer is rebuilt when code changes
RUN pnpm install --frozen-lockfile --offline
```

**Multi-stage builds.** A Dockerfile can declare several `FROM` stages. Earlier stages do
heavy work (install dev tooling, compile TypeScript); the final stage copies only the
finished artifacts out of them. The toolchain never ships in the final image, so it stays
small. Lingua's service image, for example, has a `workspace` stage (full install), a
`build` stage (compile), and a tiny `runtime` stage that copies only the compiled output
and pruned production dependencies.

**Non-root.** By default a container runs as `root`, which is a security risk — if an
attacker escapes the app they have root inside the container. Production images should run
as an unprivileged user. Every Lingua runtime image ends with `USER node` (or uses the
`nginx-unprivileged` base), so nothing runs as root.

**`.dockerignore`.** When you build, Docker sends the whole build context (the directory
you point it at) to the build engine. `.dockerignore` excludes files you never want sent
or baked in — see [.dockerignore](../.dockerignore), which drops `node_modules`, `dist`,
`.git`, the `.env` file (secrets are injected at runtime, never baked in), and the Helm
charts.

**Docker Compose.** Building one image is fine, but a real system is many moving parts
(database + cache + broker + auth + object store). **Docker Compose** describes a whole set
of containers in one YAML file and starts them together with one command. Key concepts:

- **services** — each named entry is one container (or a group of replicas).
- **volumes** — named, persistent disk storage that survives container restarts (so your
  database data is not wiped every time).
- **networks** — a private virtual network so containers can reach each other by service
  name (e.g. `postgres`, `kafka`) instead of by IP.
- **profiles / multiple files** — you can layer extra Compose files on top of a base file
  with repeated `-f` flags to add optional pieces.

## How Lingua uses it

Lingua has **two distinct uses of Docker**, and it is important not to conflate them:

1. **Compose, for local development of infrastructure only.** During day-to-day dev you
   run the application services *on your host* with `nx serve` (fast reloads, debugger,
   no rebuilds). Compose only runs the *stateful dependencies* those services connect to —
   Postgres, Redis, Kafka, Keycloak, MinIO. The app services are **not** in the dev
   Compose file.

2. **Production images, for Kubernetes.** Each service, frontend, and the public site has a
   real image, built from one of three parameterized Dockerfiles and pushed to a registry.
   Those images are what Kubernetes runs (see [./12-kubernetes-helm.md](./12-kubernetes-helm.md)).
   These images are **never** used for local dev.

### The three Dockerfiles

All three live in `infra/docker/`, are multi-stage, run non-root, and share an identical
first `workspace` stage (full monorepo install) so the build engine reuses those layers
across all images. **Build context is always the monorepo root** — you build with `-f
infra/docker/Dockerfile.X` and a trailing `.`.

| Dockerfile | Builds | Final runtime |
| --- | --- | --- |
| [Dockerfile.service](../infra/docker/Dockerfile.service) | Any NestJS service (`--build-arg SERVICE=svc-vocabulary`) | `node` running the compiled `dist/apps/service/src/main.js` |
| [Dockerfile.mfe](../infra/docker/Dockerfile.mfe) | The shell or any micro-frontend (`--build-arg PROJECT=shell`) | `nginx-unprivileged` serving the static Rspack build |
| [Dockerfile.web-public](../infra/docker/Dockerfile.web-public) | The Next.js public site | `node` running the Next standalone `server.js` |

**Dockerfile.service** is the most interesting. One parameterized file builds *every*
backend service — you pick which with `--build-arg SERVICE=<name>`. Its stages:

- `workspace` — installs the full monorepo (`pnpm fetch` + `pnpm install --offline`).
- `build` — compiles one service together with the `@lingua/*` libs. The libs are
  TypeScript-source workspace packages, so for plain `node` they are compiled alongside
  the app (`tsc -p apps/<svc>/tsconfig.docker.json`) and the `@lingua/*` import aliases are
  rewritten to relative paths (`tsc-alias`). Then `pnpm deploy --prod` produces a pruned
  `node_modules` containing only that service's production dependencies.
- `runtime` — copies just the pruned `node_modules`, the compiled `dist`, and the `.proto`
  contract files (loaded at runtime by the gRPC transport), then `USER node`.
- `migrator` (a second selectable target) — the **shared migrator image**, described below.

Two things this image deliberately does **not** do: it does not bake in secrets (they come
from runtime env), and it **never runs code generation** — the committed generated
TypeScript is simply compiled with the rest of the libs, and `.proto` files are copied as
static assets.

**Dockerfile.mfe** builds the shell or any micro-frontend. Frontend URLs (the BFF address,
the remote-module manifests) are baked at **build** time via build args, because Rspack and
Module Federation resolve them when bundling. The build runs `nx build <project>`, and the
final stage is `nginx-unprivileged` (listens on 8080, runs as a non-root uid) serving the
static `dist`.

**Dockerfile.web-public** builds the Next.js public site. Next is configured for
`output: 'standalone'`, which emits a self-contained server with a pruned `node_modules`.
Unlike the MFEs, its URLs (`SITE_URL`, `CONTENT_PUBLIC_API_URL`) are read at **request**
time (server-side rendering), so they are runtime env, not build args. It runs on port
`4205` as `USER node`.

### The migrator image

Database migrations and seed data must not run inside an application container (you do not
want every replica racing to migrate). Instead there is **one shared `migrator` image** —
the `migrator` target of `Dockerfile.service`. It keeps the full workspace plus the Prisma
CLI and generated clients for every service. Kubernetes uses it two ways:

- as an **initContainer** that runs `prisma migrate deploy` before a service's pod starts,
- as a post-install **Job** that runs the `svc-content` seed script.

One image serves every service; Kubernetes overrides the working directory and command per
use. (See the Helm deployment template in [./12-kubernetes-helm.md](./12-kubernetes-helm.md).)

### What `docker-compose.dev.yml` brings up

[docker-compose.dev.yml](../infra/docker/docker-compose.dev.yml) starts the stateful
dependencies. Host-facing ports match the repo-root `.env`:

| Container | Image | Host port(s) | Purpose |
| --- | --- | --- | --- |
| `lingua-postgres` | `postgres:18-alpine` | `5432` | One Postgres with **seven logical databases**, one per service, created on first boot by [postgres/init-databases.sh](../infra/docker/postgres/init-databases.sh) |
| `lingua-redis` | `redis:7-alpine` | `6379` | Redis cache (reserved for future use) |
| `lingua-kafka` | `apache/kafka:3.9.0` | `9092` | Single-node Kafka broker in **KRaft** mode (no ZooKeeper) |
| `lingua-kafka-setup` | `apache/kafka:3.9.0` | — | One-shot job that pre-creates the event topics, then exits |
| `lingua-keycloak` | `quay.io/keycloak/keycloak:26.1` | `8080` | OIDC auth server (`start-dev`), imports the `lingua` realm on first boot |
| `lingua-minio` | `minio/minio:latest` | `9000` (S3 API), `9001` (console) | Object store for conversation audio |
| `lingua-minio-setup` | `minio/mc:latest` | — | One-shot job that creates the `lingua-audio` bucket and makes it download-public, then exits |

The Postgres init script creates the databases `identity`, `vocabulary`, `learning`,
`dialog`, `content`, `progress`, and `notifications` — each service owns one. It runs only
on first boot (empty data dir) and is re-run safe. Data persists in named volumes
(`postgres-data`, `redis-data`, `kafka-data`, `minio-data`), so stopping the stack does not
lose your data. All containers join one private network named `lingua-dev`.

The two `*-setup` containers are a common Compose idiom: a throwaway container that waits
for its dependency to become healthy, performs one-time setup (create topics, create the
bucket), and exits `0`.

### The two optional overlays

Two extra Compose files layer **on top of** the dev file (you pass both with `-f`). Both
add an internal Kafka listener (`kafka:29092`) so containerized clients can reach the
broker by service name — they are written identically so you can stack either or both:

- [docker-compose.observability.yml](../infra/docker/docker-compose.observability.yml) —
  adds the OpenTelemetry Collector, Tempo (traces), Loki (logs), Prometheus (metrics),
  Grafana (dashboards on host port `3001`), and a Kafka consumer-lag exporter. See
  [./13-observability.md](./13-observability.md).
- [docker-compose.schema-registry.yml](../infra/docker/docker-compose.schema-registry.yml) —
  adds the Confluent Schema Registry on host port `8081`, so Kafka events can be encoded
  as Protobuf. See [./05-messaging-kafka.md](./05-messaging-kafka.md) and
  [./06-grpc-contracts.md](./06-grpc-contracts.md).

Both are **opt-in**: the application code only uses them when the matching env var is set
(`OTEL_EXPORTER_OTLP_ENDPOINT`, `SCHEMA_REGISTRY_URL`). Without those vars the stack runs
exactly as before.

## Key files

- [infra/docker/Dockerfile.service](../infra/docker/Dockerfile.service) — every NestJS
  service + the shared `migrator` target.
- [infra/docker/Dockerfile.mfe](../infra/docker/Dockerfile.mfe) — shell + micro-frontends
  (static, served by nginx).
- [infra/docker/Dockerfile.web-public](../infra/docker/Dockerfile.web-public) — Next.js
  public site (standalone server).
- [infra/docker/docker-compose.dev.yml](../infra/docker/docker-compose.dev.yml) — local
  infrastructure dependencies.
- [infra/docker/docker-compose.observability.yml](../infra/docker/docker-compose.observability.yml) —
  optional observability overlay.
- [infra/docker/docker-compose.schema-registry.yml](../infra/docker/docker-compose.schema-registry.yml) —
  optional Schema Registry overlay.
- [infra/docker/postgres/init-databases.sh](../infra/docker/postgres/init-databases.sh) —
  creates the seven per-service databases.
- [.dockerignore](../.dockerignore) — keeps the build context lean and secrets out.

## See it in action

Start the local infrastructure (run from the repo root):

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

`-d` runs detached (in the background). Check status and follow logs:

```bash
docker compose -f infra/docker/docker-compose.dev.yml ps
docker compose -f infra/docker/docker-compose.dev.yml logs -f kafka
```

Layer on the optional overlays by adding more `-f` flags (order matters — base first):

```bash
docker compose \
  -f infra/docker/docker-compose.dev.yml \
  -f infra/docker/docker-compose.observability.yml \
  up -d
```

Tear it down. Plain `down` keeps your data volumes; add `-v` to wipe them too:

```bash
docker compose -f infra/docker/docker-compose.dev.yml down      # stop, keep data
docker compose -f infra/docker/docker-compose.dev.yml down -v   # stop and delete volumes
```

Build a single production service image by hand (note the `SERVICE` build arg and the
trailing `.` for the repo-root context):

```bash
docker build -f infra/docker/Dockerfile.service \
  --build-arg SERVICE=svc-vocabulary \
  -t lingua/svc-vocabulary .
```

Build the shared migrator image (the `migrator` target of the same Dockerfile):

```bash
docker build -f infra/docker/Dockerfile.service \
  --target migrator -t lingua/migrator .
```

In practice you rarely build images one at a time — the
[scripts/k8s/build-images.sh](../scripts/k8s/build-images.sh) script builds and pushes all
of them for the Kubernetes deployment (covered in the next doc).

## Related

- [./12-kubernetes-helm.md](./12-kubernetes-helm.md) — running these images in a cluster.
- [./02-monorepo-nx-pnpm.md](./02-monorepo-nx-pnpm.md) — the `nx build` commands the images
  invoke and the `@lingua/*` workspace libs they compile.
- [./04-data-prisma.md](./04-data-prisma.md) — Prisma, migrations, and the seed the
  migrator image runs.
- [./07-auth-keycloak.md](./07-auth-keycloak.md) — the Keycloak realm imported on boot.
- [./13-observability.md](./13-observability.md) — the observability overlay.
- [./05-messaging-kafka.md](./05-messaging-kafka.md) — Kafka topics and the Schema Registry
  overlay.
- [./QUICKSTART.md](./QUICKSTART.md) — the fastest path to a running stack.
