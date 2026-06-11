# Quick start — running Lingua locally

This guide gets the whole system running on your machine, on **Windows, macOS, or Linux**.
No cloud account and no API keys are required: the infrastructure runs in Docker, and the
AI features fall back to built-in offline fakes by default.

There are two ways to run Lingua:

1. **Dev mode (recommended to start)** — Docker runs only the infrastructure
   (databases, Kafka, Keycloak, etc.); the application services and frontends run directly
   on your machine with hot reload. This is fast and easy to debug.
2. **Kubernetes mode** — the entire system (apps included) runs in a local Kubernetes
   cluster. Closer to production; heavier. See [12-kubernetes-helm.md](./12-kubernetes-helm.md).

This page covers **dev mode**.

---

## 1. What you'll be running

`docker compose` starts the stateful infrastructure:

| Container | Purpose |
|-----------|---------|
| PostgreSQL | one database per service |
| Redis | cache (reserved) |
| Kafka | event bus (KRaft mode, no ZooKeeper) |
| Keycloak | login / identity provider |
| MinIO | object storage for audio |

Then Nx runs the **9 backend services + 5 frontends + the public site** on your host.

When you finish you'll have the app at **http://localhost:4200**, logging in as
`learner` / `learner`.

---

## 2. Prerequisites

You need three things on every OS: **Docker**, **Node.js 24**, and **pnpm** (via corepack).
Pick the column for your OS.

### Common requirement: Docker

- **Windows** — install **Docker Desktop** and enable the **WSL 2** backend
  (Docker Desktop → Settings → General → "Use the WSL 2 based engine"). Give it at least
  **4 GB RAM** (Settings → Resources). For the Kubernetes path, 6–8 GB.
- **macOS** — install **Docker Desktop** (Apple Silicon or Intel build), or **Colima**
  (`brew install colima docker && colima start`).
- **Linux** — install **Docker Engine** and the **Compose plugin**
  (`docker compose version` should work). Add your user to the `docker` group so you don't
  need `sudo`.

Verify: `docker run --rm hello-world` should print a success message.

### Node.js 24 + pnpm

The repo pins **Node 24** (see [.nvmrc](../.nvmrc)) and **pnpm 11** (via corepack, which
ships with Node). Do **not** use `npm` — this is a pnpm workspace.

| OS | Install Node 24 | Enable pnpm |
|----|-----------------|-------------|
| **Windows** | `winget install OpenJS.NodeJS.LTS` (or use [fnm](https://github.com/Schniz/fnm): `winget install Schniz.fnm` then `fnm install 24 && fnm use 24`) | `corepack enable` |
| **macOS** | `brew install fnm` then `fnm install 24 && fnm use 24` (or `nvm install 24`) | `corepack enable` |
| **Linux** | `nvm install 24 && nvm use 24` (or your distro's Node 24 package) | `corepack enable` |

Verify:

```bash
node -v        # v24.x
corepack -v    # any version
```

`corepack enable` lets the repo's pinned `pnpm@11` activate automatically the first time
you run `pnpm` in the project (it reads the `packageManager` field in
[package.json](../package.json)).

> **Windows tip:** run the commands in **PowerShell** or **Git Bash**. The helper scripts
> come in both flavours — `*.ps1` for PowerShell and `*.sh` for bash/macOS/Linux.

---

## 3. Run it (all operating systems)

From the repository root:

```bash
# 1. Install dependencies (first run downloads a lot; later runs are cached)
corepack enable
pnpm install

# 2. Create your local environment file from the template
cp .env.example .env
#   Windows PowerShell:  Copy-Item .env.example .env

# 3. Start the infrastructure in Docker (Postgres, Redis, Kafka, Keycloak, MinIO)
docker compose -f infra/docker/docker-compose.dev.yml up -d

# 4. Wait ~20–30s for Postgres/Kafka/Keycloak to become healthy, then check:
docker compose -f infra/docker/docker-compose.dev.yml ps

# 5. Generate the Prisma database clients and apply migrations (one DB per service)
pnpm nx run-many -t prisma-generate
pnpm nx run svc-identity:prisma-migrate
pnpm nx run svc-vocabulary:prisma-migrate
pnpm nx run svc-learning:prisma-migrate
pnpm nx run svc-ai-dialog:prisma-migrate
pnpm nx run svc-content:prisma-migrate
pnpm nx run svc-progress:prisma-migrate
pnpm nx run svc-notifications:prisma-migrate

# 6. Seed starter content (5 conversation scenarios + lessons + a deck template)
pnpm nx run svc-content:prisma-seed

# 7. Run everything (services + frontends + public site)
pnpm serve
#   equivalent to: pnpm nx run-many -t serve --parallel=16
```

> **Why `--parallel=16`?** `serve` targets are long-running processes. By default Nx runs
> only a few tasks at once, so the rest would sit in a queue and never start. The parallel
> count must be at least the number of apps you're starting. `pnpm serve` already sets this.

Now open **http://localhost:4200**, click **Log in**, and sign in as **`learner` / `learner`**.

Try it: **Learn** (review cards) → **Speak** (pick a scenario, hold the mic button, talk,
release — you'll see a transcript and a streamed AI reply with audio) → **Progress** (charts).
Log in as **`admin` / `admin`** to see the **Studio** admin tab.

To stop the apps, press `Ctrl+C` in the terminal running `pnpm serve`. To stop the
infrastructure:

```bash
docker compose -f infra/docker/docker-compose.dev.yml down
#   add -v to also delete the data volumes (fresh start next time)
```

---

## 4. Ports

| App | URL |
|-----|-----|
| shell (the app you open) | http://localhost:4200 |
| mfe-learner / speaking / progress / studio | http://localhost:4201–4204 |
| web-public (Next.js public site) | http://localhost:4205 |
| gateway-bff (API + WebSocket) | http://localhost:3000 |
| svc-identity … svc-notifications | http://localhost:3101–3108 |
| Keycloak (admin: `admin` / `admin`) | http://localhost:8080 |
| PostgreSQL | localhost:5432 (`lingua` / `lingua`) |
| Kafka | localhost:9092 |
| Redis | localhost:6379 |
| MinIO API / console | localhost:9000 / 9001 (`minioadmin` / `minioadmin`) |

---

## 5. Optional layers

All of these are opt-in and off by default.

### Real AI engines

Edit `.env` and set the provider(s) you want (see [10-ai-speech.md](./10-ai-speech.md)):

```env
LLM_PROVIDER=anthropic        # real streaming LLM; also set ANTHROPIC_API_KEY=...
STT_PROVIDER=transformers     # Whisper speech-to-text; pnpm add -w @huggingface/transformers
TTS_PROVIDER=piper            # text-to-speech; requires the `piper` CLI on PATH
```

Leave them as `fake` to run fully offline.

### Observability stack (traces, metrics, logs)

```bash
docker compose -f infra/docker/docker-compose.dev.yml \
               -f infra/docker/docker-compose.observability.yml up -d
# then set OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 in .env and restart `pnpm serve`
```

Grafana opens at **http://localhost:3001**. See [13-observability.md](./13-observability.md).

### Kafka Schema Registry (Protobuf events)

```bash
docker compose -f infra/docker/docker-compose.dev.yml \
               -f infra/docker/docker-compose.schema-registry.yml up -d
# then set SCHEMA_REGISTRY_URL=http://localhost:8081 in .env
```

See [06-grpc-contracts.md](./06-grpc-contracts.md).

### Run in Kubernetes instead

```bash
./scripts/k8s/up.sh      # macOS / Linux
./scripts/k8s/up.ps1     # Windows
```

See [12-kubernetes-helm.md](./12-kubernetes-helm.md).

---

## 6. Troubleshooting

**A port is already in use.** Something else is on 4200/3000/5432/8080/9092. Stop it, or
find the offender: macOS/Linux `lsof -i :4200`, Windows `netstat -ano | findstr :4200`.

**`docker compose` says it can't connect / daemon not running.** Start Docker Desktop
(Windows/macOS) or `sudo systemctl start docker` (Linux), and re-run the command.

**Services can't reach Postgres/Kafka right after `up -d`.** The containers need a few
seconds to become healthy. Run `docker compose ... ps` and wait until they're `healthy`/`running`,
then run the migrations.

**Migrations fail with "database does not exist".** The Postgres init script creates the
per-service databases on first boot. If you started the stack before, recreate the volume:
`docker compose -f infra/docker/docker-compose.dev.yml down -v` then `up -d` again.

**Only a few apps start, the rest hang.** You ran `nx run-many -t serve` without a high
enough `--parallel`. Use `pnpm serve` (it sets `--parallel=16`).

**Login redirect fails / "invalid issuer".** Make sure you open the app at
`http://localhost:4200` (not `127.0.0.1`), so the browser and Keycloak agree on the host.
Keycloak takes ~20s to import the realm on first boot.

**`pnpm` not found, or it tries to use npm.** Run `corepack enable`. If your Node is older
than 24, switch with `fnm use 24` / `nvm use 24`.

**Windows: a `*.sh` script won't run.** Use the `*.ps1` version in PowerShell, or run the
`*.sh` one from Git Bash / WSL. If a script has Windows line endings, run it via `bash script.sh`.

**Reset everything to a clean slate:**

```bash
docker compose -f infra/docker/docker-compose.dev.yml down -v
# then repeat the steps in section 3
```

---

## Next steps

- Understand the whole system: [01-architecture.md](./01-architecture.md)
- Browse all the technology guides: [docs index](./README.md)
