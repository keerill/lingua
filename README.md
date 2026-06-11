# Lingua

Lingua is an AI-powered English trainer. It combines a spaced-repetition vocabulary
system with real-time conversation practice, and closes the loop between them: words
you stumble on while speaking automatically resurface in your review queue.

It is built as a distributed system — independent backend microservices, a
micro-frontend web client, asynchronous messaging over Kafka, and OpenID Connect
authentication — and is meant equally as a working product and a portfolio piece
demonstrating that architecture end to end.

---

## What it does

- **Learn** — decks and flashcards scheduled with the FSRS spaced-repetition algorithm.
- **Speak** — pick a scenario and have a spoken conversation with an AI: speech-to-text →
  streaming LLM reply → text-to-speech, plus pronunciation feedback.
- **Feedback loop** — a mistake detected during conversation is published as an event;
  the vocabulary service seeds a "Speaking practice" deck and the learning service marks
  those cards due now.
- **Progress** — live charts (streaks, words learned, reviews per day, pronunciation trend)
  built from the event stream.
- **Studio** — an admin UI to edit conversation scenarios; changes take effect on the next turn.
- **Public site** — a server-rendered marketing/SEO site, separate from the app.

---

## Architecture at a glance

```
                          Browser
                             │
        ┌────────────────────┼─────────────────────┐
        │                    │                      │
   shell (host)         gateway-bff            web-public
   + micro-frontends    (REST + WebSocket)     (Next.js SSR)
   (Module Federation)       │
                             │ gRPC (internal) / REST
        ┌──────────┬─────────┼──────────┬───────────┬───────────┐
   svc-identity  svc-     svc-       svc-ai-     svc-speech   svc-content
                vocabulary learning   dialog                  svc-progress
                                                              svc-notifications
        │          │         │          │
        └──────────┴────┬────┴──────────┘
                        │ events via transactional outbox
                     Apache Kafka
```

- Each service owns its own PostgreSQL database (database-per-service).
- Services never write to Kafka directly; they use a **transactional outbox** so a domain
  change and its event are committed in one transaction, then relayed to Kafka.
- The **gateway-bff** (backend-for-frontend) is the only thing the browser talks to. It
  validates the Keycloak token, aggregates reads, and proxies to services over gRPC.
- Authentication is delegated to **Keycloak** (OIDC, Authorization Code + PKCE). Lingua
  never issues its own JWTs — services validate Keycloak tokens against its JWKS endpoint.

A full explanation of every technology and pattern lives in **[docs/](docs/)**.

---

## Tech stack

| Layer | Technologies |
|-------|--------------|
| Monorepo | Nx 22, pnpm 11 (via corepack), Node 24 |
| Frontend | React 19, React Router 7, TanStack Query 5, Rspack 1.6 + Module Federation 2.0, SCSS Modules, Recharts |
| Public site | Next.js 16 (App Router, SSR) — standalone, not federated |
| Backend | NestJS 11 (Hexagonal / Ports & Adapters + DDD), TypeScript |
| Data | Prisma 7 (`@prisma/adapter-pg`), PostgreSQL 18 (database-per-service), Redis 7, MinIO (audio) |
| Messaging | Apache Kafka (KRaft), `@confluentinc/kafka-javascript`, transactional outbox, optional Schema Registry (Protobuf) |
| Internal RPC | gRPC (`@grpc/grpc-js`), Protobuf contracts via Buf |
| Auth | Keycloak 26 (OIDC, PKCE, JWKS validation) |
| SRS | `ts-fsrs` |
| AI | Anthropic SDK (LLM), Transformers.js / Whisper (STT), Piper (TTS) — all behind ports with offline fakes |
| Observability | OpenTelemetry → Collector → Tempo / Prometheus / Loki / Grafana |
| Infrastructure | Docker, Docker Compose, Kubernetes (k3d / Helm), Terraform (DigitalOcean), GitHub Actions |

---

## Repository layout

```
apps/
  shell/             Module Federation host — layout, auth, loads the remotes
  mfe-learner/       remote — decks, cards, review screen
  mfe-speaking/      remote — conversation UI (record / playback)
  mfe-progress/      remote — progress dashboard (charts)
  mfe-studio/        remote — admin scenario editor
  web-public/        Next.js public SSR site (standalone)
  gateway-bff/       backend-for-frontend (REST + WebSocket, gRPC client)
  svc-identity/      user profiles (id = Keycloak subject)
  svc-vocabulary/    decks / cards, publishes vocabulary.card.created
  svc-learning/      FSRS scheduling, review logs
  svc-ai-dialog/     conversation turns, mistake detection
  svc-speech/        speech-to-text / text-to-speech, pronunciation scoring
  svc-content/       scenarios / lessons / deck templates
  svc-progress/      event-sourced read model
  svc-notifications/ reminder scheduler
libs/
  contracts/         shared TS types + Protobuf IDL (single source of truth)
  kafka/             Kafka client + transactional outbox relay
  auth/              Keycloak JWKS validation, Nest guard, @CurrentUser, @Roles
  grpc/              gRPC client/server helpers
  observability/     OpenTelemetry setup and logger
infra/
  docker/            Dockerfiles, docker-compose files, Keycloak realm, init scripts
  helm/              Helm umbrella chart + subcharts
  terraform/         DigitalOcean infrastructure as code
  k8s/               cluster add-ons (CoreDNS rewrite)
scripts/             k8s up/down/build helpers, CI image matrix
docs/                full technology documentation + quick start
```

---

## Quick start (local dev)

Full prerequisites and per-OS instructions are in **[docs/QUICKSTART.md](docs/QUICKSTART.md)**.
The short version:

```bash
# 1. Install dependencies (pnpm via corepack)
corepack enable
pnpm install

# 2. Environment
cp .env.example .env

# 3. Start infrastructure (Postgres, Redis, Kafka, Keycloak, MinIO)
docker compose -f infra/docker/docker-compose.dev.yml up -d

# 4. Generate Prisma clients and run migrations (one DB per service)
pnpm nx run-many -t prisma-generate
pnpm nx run svc-identity:prisma-migrate
pnpm nx run svc-vocabulary:prisma-migrate
pnpm nx run svc-learning:prisma-migrate
pnpm nx run svc-ai-dialog:prisma-migrate
pnpm nx run svc-content:prisma-migrate
pnpm nx run svc-progress:prisma-migrate
pnpm nx run svc-notifications:prisma-migrate
pnpm nx run svc-content:prisma-seed        # 5 scenarios + lessons + a deck template

# 5. Run everything (services + micro-frontends + public site).
#    serve targets are long-running, so --parallel must be >= the number of apps,
#    otherwise Nx queues them.
pnpm nx run-many -t serve --parallel=16     # or: pnpm serve
```

Open **http://localhost:4200**, click **Log in**, and sign in as `learner` / `learner`.
The AI providers default to deterministic fakes, so the whole flow works offline with no
API keys.

### Ports

| App | URL |
|-----|-----|
| shell (host) | http://localhost:4200 |
| mfe-learner / speaking / progress / studio | http://localhost:4201–4204 |
| web-public (Next SSR) | http://localhost:4205 |
| gateway-bff | http://localhost:3000 |
| svc-identity … svc-notifications | http://localhost:3101–3108 |
| Keycloak | http://localhost:8080 |
| PostgreSQL | localhost:5432 |
| Kafka | localhost:9092 |
| Redis | localhost:6379 |
| MinIO (API / console) | localhost:9000 / 9001 |

---

## Authentication

The Keycloak realm `lingua` is imported automatically on first boot. It contains:

- public client `lingua-shell` — PKCE (S256), used by the browser;
- confidential client `lingua-bff` — secret `lingua-bff-secret`, used by the BFF to exchange the code;
- roles `learner` and `admin`;
- test users `learner` / `learner` and `admin` / `admin`.

Keycloak admin console: http://localhost:8080 (`admin` / `admin`).

**Auth flow (PKCE at the BFF):** the SPA starts login at the BFF, which redirects to
Keycloak with a PKCE challenge. On callback the BFF exchanges the code, stores the refresh
token in an httpOnly cookie, and returns the access token to the SPA. The SPA sends
`Authorization: Bearer <token>` to the BFF; on `401` it silently refreshes.

---

## Public API (gateway-bff)

```
POST /decks                {title, langFrom, langTo}     -> Deck
GET  /decks                                              -> Deck[]
POST /decks/:deckId/cards  {term, translation, example?} -> Card
GET  /reviews/queue?limit=20                             -> DueCard[]   (aggregates learning + vocabulary)
POST /reviews/:cardId      {grade: 1|2|3|4}              -> NextSchedule (FSRS recompute)
```

The realtime speaking channel is a WebSocket at `/realtime/speaking`.

---

## Running on Kubernetes

The whole stack runs in a local Kubernetes cluster (k3d) via a Helm umbrella chart:

```bash
./scripts/k8s/up.sh       # macOS / Linux
./scripts/k8s/up.ps1      # Windows
```

This builds the images, installs the chart, and exposes the app at
`http://app.lingua.localhost`. See **[docs/12-kubernetes-helm.md](docs/12-kubernetes-helm.md)**
for details, and **[docs/15-terraform.md](docs/15-terraform.md)** for the managed cloud deployment.

---

## Testing

```bash
pnpm nx run-many -t test     # unit + integration tests across all projects
pnpm nx e2e gateway-bff-e2e  # end-to-end flow through the BFF
pnpm nx run-many -t build    # typecheck + build every project
pnpm buf:lint                # validate the Protobuf contracts
```

---

## Documentation

The **[docs/](docs/)** folder explains every technology and pattern from first principles —
microservices, the transactional outbox, Module Federation, Kafka, gRPC, Keycloak,
observability, Docker, Kubernetes, and Terraform — and includes a cross-platform
**[quick-start guide](docs/QUICKSTART.md)**.
