# Lingua documentation

This folder explains every technology and architectural pattern used in Lingua, written
for someone who is comfortable programming but new to distributed systems, microservices,
Docker, Kafka, Kubernetes, and the rest of the stack. Each guide explains the **general
concept first**, then shows **how this repository uses it**, with links to the real files.

If you just want to run the project, start with the **[Quick start](./QUICKSTART.md)**.

---

## Reading order

If you're new to all of this, read in roughly this order:

1. **[Quick start](./QUICKSTART.md)** — get it running on your machine (Windows/macOS/Linux).
2. **[01 — Architecture](./01-architecture.md)** — the big picture: how the pieces fit together.
3. **[02 — Monorepo: Nx & pnpm](./02-monorepo-nx-pnpm.md)** — how the codebase is organized and built.
4. **[03 — Backend: NestJS & hexagonal architecture](./03-backend-nestjs.md)** — how a service is structured.
5. **[04 — Data: Prisma & PostgreSQL](./04-data-prisma.md)** — databases, migrations, the data stores.
6. **[05 — Messaging: Kafka & the outbox](./05-messaging-kafka.md)** — events, and how services stay in sync.

The rest can be read in any order, as you get curious about a particular part.

---

## All guides

### Foundations
- **[01 — Architecture](./01-architecture.md)** — microservices, database-per-service, the BFF, sync vs async communication, and the end-to-end request flows.
- **[02 — Monorepo: Nx & pnpm](./02-monorepo-nx-pnpm.md)** — the monorepo, Nx task running / caching / `affected`, pnpm workspaces, Node version pinning.

### Backend
- **[03 — Backend: NestJS](./03-backend-nestjs.md)** — NestJS, dependency injection, Hexagonal (Ports & Adapters) + DDD, walked through one real service.
- **[04 — Data: Prisma & PostgreSQL](./04-data-prisma.md)** — ORMs, Prisma, database-per-service, migrations, Redis and MinIO.
- **[05 — Messaging: Kafka & the outbox](./05-messaging-kafka.md)** — message brokers, Kafka, the transactional outbox, and the feedback loop.
- **[06 — gRPC & contracts](./06-grpc-contracts.md)** — RPC, gRPC, Protobuf, Buf codegen, and `libs/contracts` as the single source of truth.

### Frontend
- **[07 — Auth: Keycloak & OIDC](./07-auth-keycloak.md)** — OAuth2/OpenID Connect, PKCE, the BFF auth flow, JWKS validation.
- **[08 — Frontend: micro-frontends & Module Federation](./08-frontend-mfe.md)** — micro-frontends, Module Federation 2.0, Rspack, the MVVM split.
- **[09 — Public site: Next.js](./09-web-public-next.md)** — server-side rendering, the App Router, and why this site is standalone.

### AI & observability
- **[10 — AI & speech](./10-ai-speech.md)** — pluggable LLM/STT/TTS ports, offline fakes vs real engines, the speaking pipeline.
- **[13 — Observability](./13-observability.md)** — logs/metrics/traces, OpenTelemetry, and end-to-end tracing across Kafka.

### Infrastructure & delivery
- **[11 — Docker & Docker Compose](./11-docker.md)** — images, containers, the Dockerfiles, and the local infra stack.
- **[12 — Kubernetes & Helm](./12-kubernetes-helm.md)** — running the whole system in a local cluster.
- **[14 — CI/CD: GitHub Actions](./14-ci-cd.md)** — automated build/test/deploy with `nx affected`.
- **[15 — Terraform](./15-terraform.md)** — provisioning managed cloud infrastructure as code.

---

## Conventions in these docs

- File links point at the real source, e.g. [libs/kafka/src/outbox.ts](../libs/kafka/src/outbox.ts) — click through and read along.
- Commands are meant to be run from the **repository root** unless stated otherwise.
- Anything that needs an external account or costs money (the cloud deployment) is clearly marked.
