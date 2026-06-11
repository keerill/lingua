# 12 — Kubernetes & Helm

Docker Compose ([./11-docker.md](./11-docker.md)) is great for running a handful of
containers on one machine. Real distributed systems need more: many copies of each service
spread across many machines, automatic restarts when something crashes, rolling updates
with no downtime, and a uniform way to inject configuration and secrets. That is what
**Kubernetes** does. **Helm** is the tool that packages a Kubernetes application so it can
be installed with a single command. This document explains both from scratch, then walks
through exactly how Lingua uses them.

## What is it

### Kubernetes, from the ground up

Kubernetes (often "k8s") is a **container orchestrator**: you give it a *desired state*
("I want three copies of svc-vocabulary running, reachable on port 3102"), and it
continuously works to make reality match — scheduling containers onto machines, restarting
the ones that die, and replacing them during upgrades. You describe everything as YAML
**objects**; the cluster reconciles toward them. The objects Lingua uses:

- **Pod** — the smallest unit: one (or a few tightly-coupled) running containers sharing a
  network address. You rarely create pods directly; something else manages them.
- **Deployment** — manages a set of identical pods. It guarantees "always keep N replicas
  running," and performs **rolling updates**: when you ship a new image it brings up new
  pods and retires old ones gradually, so the app never fully goes down.
- **Service** — a stable in-cluster network name and IP in front of a Deployment's pods.
  Pods come and go (each with a different IP), but the Service name (e.g.
  `http://svc-content:3106`) is constant. Other pods reach a service by that DNS name.
- **Ingress** — routes *external* HTTP traffic from outside the cluster to the right
  Service, based on hostname or path. An **ingress controller** (Lingua uses **Traefik**)
  is the actual proxy that implements those rules.
- **ConfigMap** — a bag of non-secret configuration (key/value or whole files) you mount or
  inject as env vars, so config lives outside the image.
- **Secret** — like a ConfigMap but for sensitive values (passwords, API keys). Injected
  the same way; kept out of image layers and out of source control.
- **initContainer** — a container that runs to completion *before* the main container of a
  pod starts. Lingua uses one to run database migrations first.
- **Job** — a pod that runs a task once to completion (rather than staying up). Lingua uses
  one to seed demo content after install.

**What this buys you over Compose.** Compose runs containers on one host with no
self-healing, no rolling updates, and no notion of secrets/config as first-class objects.
Kubernetes adds all of that plus horizontal scaling across many machines. The cost is
complexity — which is exactly why Helm exists.

### k3d / k3s — Kubernetes on your laptop

A full Kubernetes cluster is heavy. **k3s** is a lightweight, single-binary Kubernetes
distribution; **k3d** runs k3s *inside Docker* so you can spin up a real (if small) cluster
on your laptop in seconds. Lingua's local cluster is k3d running Kubernetes ~1.36 with
Traefik as the ingress controller. It behaves like a real cluster, so the same Helm charts
work locally and in the cloud.

### Helm — the package manager for Kubernetes

Writing dozens of raw YAML files by hand (a Deployment + Service + Ingress for every one of
~15 apps, all with nearly identical boilerplate) is error-prone. **Helm** is to Kubernetes
what `apt` or `npm` is to their worlds. Core ideas:

- **Chart** — a packaged Kubernetes application: a directory of *templates* plus default
  *values*.
- **Templates** — YAML files with `{{ }}` placeholders. Helm renders them into final
  Kubernetes YAML.
- **values.yaml** — the default configuration fed into the templates. You override values
  at install time (`--set key=value` or `-f my-values.yaml`).
- **Umbrella chart + subcharts** — one top-level chart can contain many **subcharts**
  (each its own mini-chart). Installing the umbrella installs everything at once.
- **Library chart** — a special chart that ships *only reusable template definitions*, no
  installable resources of its own. Other charts `include` its helpers to avoid copy-paste.

## How Lingua uses it

Lingua ships **one umbrella Helm chart** at [infra/helm/lingua](../infra/helm/lingua) that
deploys the entire system: 9 NestJS services, 5 static frontends, the Next.js public site,
and the infrastructure dependencies (PostgreSQL, Redis, Kafka, Keycloak, MinIO).

### Chart layout

The umbrella's [Chart.yaml](../infra/helm/lingua/Chart.yaml) declares it, and every piece
lives **unpacked** under `charts/` — one subchart per service plus the shared library chart
and the dependency charts. Because the subcharts are committed directly (not fetched
archives), a plain `helm install` works without any `helm dependency build` step. The
`charts/` directory contains:

- **App subcharts** — one per app: `gateway-bff`, `svc-identity`, `svc-vocabulary`,
  `svc-learning`, `svc-ai-dialog`, `svc-speech`, `svc-content`, `svc-progress`,
  `svc-notifications`, `shell`, `mfe-learner`, `mfe-speaking`, `mfe-progress`,
  `mfe-studio`, `web-public`.
- **Dependency charts** — `postgres`, `redis`, `kafka`, `keycloak`, `minio`, all on
  official images (no third-party operators), plus the observability and schema-registry
  components.
- **`lingua-common`** — the library chart that all app subcharts share.

### The `lingua-common` library chart

Every app subchart is astonishingly thin because the real templates live once in
[charts/lingua-common](../infra/helm/lingua/charts/lingua-common). For example, the *entire*
template for the learning service,
[charts/svc-learning/templates/app.yaml](../infra/helm/lingua/charts/svc-learning/templates/app.yaml),
is a single line:

```yaml
{{ include "lingua-common.app" . }}
```

That `lingua-common.app` helper renders a Deployment, a Service, and (if enabled) an
Ingress from the subchart's own `values.yaml`. So each subchart only supplies *values* —
its image, ports, env vars, and which secrets to mount. The learning subchart's
[values.yaml](../infra/helm/lingua/charts/svc-learning/values.yaml) is the whole config:

```yaml
image:
  repository: lingua/svc-learning
port: 3103
grpcPort: 50053
migration:
  enabled: true
env:
  SVC_LEARNING_PORT: '3103'
  SVC_LEARNING_GRPC_PORT: '50053'
  KAFKA_BROKERS: '{{ .Values.global.kafkaBrokers }}'
secretEnv:
  - DATABASE_URL_LEARNING
```

The shared templates encode every cross-cutting decision in one place:

- **Naming convention** — the chart name *is* the Kubernetes Service name *is* the
  in-cluster DNS name. So `svc-content` is reachable cluster-internally at
  `http://svc-content:3106`.
- **Non-root, hardened pods** — the deployment template sets `runAsNonRoot: true`, an
  explicit numeric `runAsUser`, `seccompProfile: RuntimeDefault`, drops all Linux
  capabilities, and forbids privilege escalation — applied uniformly to every service.
- **Migrations as initContainers** — when a subchart sets `migration.enabled: true`, the
  template injects an `initContainer` using the shared **migrator** image that runs
  `prisma migrate deploy` *before* the service container starts. `migrate deploy` takes a
  database advisory lock, so multiple replicas migrating at once are race-safe.
- **Env and secrets** — the `lingua-common.env` helper turns each subchart's `env` map into
  plain env vars and each `secretEnv` entry into a `secretKeyRef` against the shared
  `lingua-secrets` Secret. This same helper is also the single place that wires the
  optional observability (`OTEL_*`), Schema Registry (`SCHEMA_REGISTRY_URL`), and managed
  Kafka auth env into *every* app when those features are toggled on in
  [values.yaml](../infra/helm/lingua/values.yaml).
- **gRPC ports and Services** — when a subchart declares `grpcPort`, the templates add a
  second container port and Service port for internal gRPC traffic.
- **Probes** — readiness and liveness HTTP probes (default path `/health`) so Kubernetes
  knows when a pod is ready and when to restart it.

### Dependency charts

The stateful dependencies are plain subcharts on official images. The Postgres subchart
runs a StatefulSet (persistent storage) and creates the seven per-service databases. The
top-level [values.yaml](../infra/helm/lingua/values.yaml) has `postgres.enabled` and
`kafka.enabled` toggles: they are `true` for the local cluster (run everything in-cluster),
but a cloud environment can set them `false` and point the apps at managed PostgreSQL and
Kafka instead — see [./15-terraform.md](./15-terraform.md).

### Keycloak in production mode, and the issuer fix

In local Compose, Keycloak runs `start-dev` with an embedded H2 database — fine for a quick
start, not for anything real. In the cluster,
[charts/keycloak/templates/deployment.yaml](../infra/helm/lingua/charts/keycloak/templates/deployment.yaml)
runs Keycloak in **production mode** (`start --import-realm`) backed by PostgreSQL, with
proper health probes.

This raises a subtle but critical problem. An OIDC token contains an **issuer** (`iss`) —
the URL of the auth server that minted it. Whoever validates the token must check it
against the *same* issuer URL. But the URL the **browser** uses to log in
(`http://id.lingua.localhost`, going through Traefik from outside) is normally different
from the URL a **service inside the cluster** would use to reach Keycloak (its internal
Service name). If those differ, the issuer in the token won't match what the validating
service expects, and every token is rejected.

Lingua fixes this by making **one URL work everywhere**. Keycloak is told its hostname is
the public `http://id.lingua.localhost`, and a CoreDNS rewrite —
[infra/k8s/coredns-custom.yaml](../infra/k8s/coredns-custom.yaml) — teaches the cluster's
DNS to resolve `id.lingua.localhost` *inside* the cluster to Traefik:

```
rewrite name id.lingua.localhost traefik.kube-system.svc.cluster.local
```

So in-cluster callers hit Traefik, which routes by Host header straight back to Keycloak.
Browser and services use the identical issuer URL, and token validation matches everywhere.
(The auth flow itself is covered in [./07-auth-keycloak.md](./07-auth-keycloak.md).)

### The seed Job

After install, content needs seeding. The
[charts/svc-content/templates/seed-job.yaml](../infra/helm/lingua/charts/svc-content/templates/seed-job.yaml)
is a Helm **hook** Job (`post-install,post-upgrade`) that runs the TypeScript seed script
inside the shared migrator image. A `backoffLimit` lets it retry while migrations are still
catching up.

### The scripts

Three idempotent scripts in `scripts/k8s/` (each with a `.sh` and a `.ps1` variant) drive
the whole local lifecycle:

- [up.sh](../scripts/k8s/up.sh) — the one-command bring-up: creates the k3d cluster (with a
  managed image registry and port 80 mapped to Traefik), applies the CoreDNS rewrite and
  restarts CoreDNS, builds and pushes all images, runs `helm upgrade --install`, then runs
  smoke checks against the public URLs.
- [build-images.sh](../scripts/k8s/build-images.sh) — builds and pushes every image to the
  k3d-managed registry: all nine backend services from `Dockerfile.service`, the shared
  `migrator`, the four MFEs and shell from `Dockerfile.mfe` (with their build-time URLs),
  and `web-public`. Pass `RESTART=1` to roll the deployments afterward.
- `down.sh` — tears the cluster down.

Because they are idempotent, re-running `up.sh` reuses an existing cluster, registry, and
release rather than recreating them.

### How you reach it

The umbrella's `global.domain` is `lingua.localhost`, and every `*.lingua.localhost` host
resolves to `127.0.0.1` in browsers. Ingresses route by subdomain (the `up.sh` smoke checks
hit exactly these):

| URL | What |
| --- | --- |
| `http://app.lingua.localhost` | The shell app (the main UI) |
| `http://api.lingua.localhost` | The gateway-bff (the browser's single API) |
| `http://www.lingua.localhost` | The Next.js public site |
| `http://id.lingua.localhost` | Keycloak |
| `http://mfe-learner.lingua.localhost` (etc.) | The micro-frontend remotes |

## Key files

- [infra/helm/lingua/Chart.yaml](../infra/helm/lingua/Chart.yaml) — the umbrella chart.
- [infra/helm/lingua/values.yaml](../infra/helm/lingua/values.yaml) — global values and
  feature toggles (`postgres.enabled`, `kafka.enabled`, observability, schema registry,
  secrets).
- [infra/helm/lingua/charts/lingua-common](../infra/helm/lingua/charts/lingua-common) — the
  shared library chart (deployment / service / ingress / env helpers).
- [infra/helm/lingua/charts/svc-learning](../infra/helm/lingua/charts/svc-learning) — a
  representative app subchart (one-line template + values only).
- [infra/helm/lingua/charts/keycloak/templates/deployment.yaml](../infra/helm/lingua/charts/keycloak/templates/deployment.yaml) —
  Keycloak in production mode on Postgres.
- [infra/k8s/coredns-custom.yaml](../infra/k8s/coredns-custom.yaml) — the CoreDNS rewrite
  that fixes the OIDC issuer.
- [scripts/k8s/up.sh](../scripts/k8s/up.sh) — one-command local cluster bring-up.
- [scripts/k8s/build-images.sh](../scripts/k8s/build-images.sh) — build and push every
  image.

## See it in action

Bring the entire stack up in a fresh local cluster (needs Docker, k3d, helm, kubectl):

```bash
./scripts/k8s/up.sh
```

When it finishes, open `http://app.lingua.localhost` (log in with `learner/learner` or
`admin/admin`).

Inspect what is running:

```bash
kubectl -n lingua get pods
kubectl -n lingua get svc,ingress
kubectl -n lingua logs deployment/svc-learning
```

After changing service code, rebuild and roll out just the images (skip recreating the
cluster):

```bash
RESTART=1 ./scripts/k8s/build-images.sh
```

Render the chart to plain Kubernetes YAML without installing — useful for seeing exactly
what the templates produce:

```bash
helm template lingua infra/helm/lingua --namespace lingua
```

Upgrade an existing release after editing values or charts:

```bash
helm upgrade --install lingua infra/helm/lingua \
  --namespace lingua --create-namespace --wait
```

Tear everything down:

```bash
./scripts/k8s/down.sh
```

## Related

- [./11-docker.md](./11-docker.md) — the images this chart deploys and the migrator image.
- [./01-architecture.md](./01-architecture.md) — the services, the BFF, and how they talk.
- [./07-auth-keycloak.md](./07-auth-keycloak.md) — OIDC and the issuer the CoreDNS fix
  protects.
- [./13-observability.md](./13-observability.md) — the optional observability stack the
  chart can enable.
- [./14-ci-cd.md](./14-ci-cd.md) — building images and deploying the chart from CI.
- [./15-terraform.md](./15-terraform.md) — provisioning a real cloud cluster with managed
  PostgreSQL and Kafka.
- [./QUICKSTART.md](./QUICKSTART.md) — the fastest path to a running stack.
