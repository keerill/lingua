# 14 — CI/CD (GitHub Actions, nx affected)

This document explains how Lingua turns a `git push` into checked, built, and (optionally)
deployed software automatically. One file — [.github/workflows/ci.yml](../.github/workflows/ci.yml)
— drives everything, and it is built around one idea: **only do work for the parts of the
monorepo that actually changed.**

## What is it

**Continuous Integration (CI)** means: every time someone proposes a code change, a machine
automatically checks it — does it lint, do the tests pass, does it build? You catch problems
in minutes, on every change, instead of discovering them days later when many changes have
piled up.

**Continuous Delivery / Deployment (CD)** is the next step: once the checks pass, the same
automation packages the software and ships it to a running environment (here, a staging
cluster). "Delivery" means it is *ready* to ship; "deployment" means it actually ships.
Lingua does the full deployment, but gated behind a switch (see the `deploy` job below).

### GitHub Actions vocabulary

GitHub Actions is GitHub's built-in automation engine. A few terms, from the outside in:

- **Workflow** — a YAML file in `.github/workflows/`. It says *when* to run and *what* to do.
- **Trigger** (`on:`) — the event that starts a workflow: a pull request, a push to a branch,
  a schedule, a manual button. Lingua triggers on `pull_request` and on `push` to `main`.
- **Job** — a named unit of work that runs on its own fresh machine. Jobs run in parallel by
  default; `needs:` makes one job wait for another.
- **Step** — a single command or reusable action inside a job, run in order.
- **Runner** — the virtual machine a job runs on. Lingua uses GitHub's `ubuntu-latest`.
- **Action** — a packaged, reusable step (e.g. `actions/checkout@v4` clones your repo). You
  can also write your own *composite* action — Lingua does, to share setup across jobs.
- **Secrets and variables** — values stored in GitHub, not in the code. **Secrets**
  (`secrets.FOO`) are encrypted and masked in logs (passwords, tokens). **Variables**
  (`vars.FOO`) are plain config (feature flags, the staging domain). Lingua uses both.
- **Matrix** — a way to run the *same* job many times with different inputs. Lingua builds a
  matrix dynamically so each affected Docker image gets its own parallel build.

### Container registry (GHCR)

A built Docker image has to live *somewhere* a cluster can pull it from. That place is a
**container registry** — like a package registry (npm), but for images. Lingua pushes to the
**GitHub Container Registry (GHCR)**, `ghcr.io`, because it is free for the repo and uses the
same GitHub login. Each image is tagged twice: with the exact commit SHA (immutable, so a
deploy always pins one precise build) and with a moving `staging` tag.

### What `nx affected` buys you

In a monorepo with a dozen apps, rebuilding and retesting *everything* on every change is slow
and wasteful. Nx understands the dependency graph between projects. `nx affected` compares two
git commits (a **base** and a **head**) and computes exactly which projects changed —
*including* projects that depend on a changed library. Everything in CI flows from that list:
only affected projects get linted/tested/built, and only affected services get a Docker image.

The base/head pair comes from `nrwl/nx-set-shas@v4`: on a push it uses the last successful CI
run; on a pull request it uses the merge-base with the target branch. (This is why several jobs
check out with `fetch-depth: 0` — Nx needs the git history to compute the diff.)

## How Lingua uses it

The whole pipeline is [.github/workflows/ci.yml](../.github/workflows/ci.yml). It runs on
`pull_request` and on `push` to `main`. A `concurrency` block cancels superseded runs on the
same PR branch so you do not waste runners on stale commits.

Every job starts the same way, so that setup lives in one place: the composite action
[.github/actions/setup-workspace/action.yml](../.github/actions/setup-workspace/action.yml).
It enables corepack (which pins pnpm from `package.json`), installs Node 24, runs
`pnpm install --frozen-lockfile`, and restores the local Nx computation cache from
`actions/cache` (there is no Nx Cloud). The cache is keyed by the lockfile hash plus the commit
SHA, with `restore-keys` falling back to the newest cache for the same lockfile — so unchanged
projects can be replayed from cache instead of rebuilt.

The five jobs, in the order they depend on each other:

### 1. `verify` — lint, test, build the affected projects

```
pnpm exec nx affected -t lint test build --parallel=3
```

This is the core CI check. For every affected project it runs three Nx targets:

- **lint** — currently a no-op (no lint targets are wired up yet), kept in the command so it
  works automatically once lint configs land.
- **test** — the Jest unit/integration tests.
- **build** — a TypeScript `tsc` typecheck (the real Docker image build happens later).

If any affected project fails to typecheck or any test fails, this job fails and the pipeline
stops.

### 2. `schema` — protobuf contract gate

The Kafka/gRPC contracts live in `libs/contracts/proto` and are the single source of truth.
This job protects them:

```
pnpm buf:lint        # buf lint libs/contracts/proto
pnpm buf:breaking    # buf breaking ... --against .git#branch=main
```

`buf lint` enforces protobuf style rules; `buf breaking` compares the proto files against
`main` and **fails if a change would break existing consumers** (e.g. renaming a field). This
runs even on forks — it needs no cloud credentials.

### 3. `matrix` — compute which Docker images to build

Building all images on every commit is wasteful, so this job decides which images are needed.
It runs [scripts/ci/affected-images.sh](../scripts/ci/affected-images.sh), which uses
`nx affected` + project **tags** to emit a JSON build matrix. It writes two outputs:

- `matrix` — the list of images to build (consumed by the next job),
- `has_images` — `true`/`false`, so the next job can skip entirely when nothing changed.

Frontends bake the public domain into the bundle *at build time*, so the script is given a
`DOMAIN` env from the `STAGING_DOMAIN` variable (default `staging.lingua.example.com`).

#### How the affected-image matrix is computed

The script never hardcodes a list of apps. Instead it asks Nx for the *affected projects
carrying a given tag*. Each app's `project.json` declares a `type:*` tag:

| Tag | Example project | Dockerfile | What is baked in |
| --- | --- | --- | --- |
| `type:service` | `svc-identity` | `Dockerfile.service` | `SERVICE=<name>` |
| `type:gateway` | `gateway-bff` | `Dockerfile.service` | `SERVICE=<name>` |
| `type:mfe-remote` | `mfe-learner` | `Dockerfile.mfe` | `PROJECT`, `BFF_URL` |
| `type:mfe-host` | `shell` | `Dockerfile.mfe` | `PROJECT`, `BFF_URL`, the four `MFE_*_REMOTE` manifest URLs |
| `type:web-ssr` | `web-public` | `Dockerfile.web-public` | nothing (SSR reads env at request time) |

The script queries each tag with `nx show projects --affected -p "tag:<tag>"`, then for every
match appends an entry `{image, file, build_args, target}` to a JSON array (built up with `jq`).
Filtering by `type:*` tags naturally excludes libraries and the e2e project — they have no such
tag, so they never produce an image.

One special case: the shared **migrator** image (the Prisma CLI used to run migrations and
seeds) is rebuilt whenever *any* service or gateway is affected, since all services share it.

You can run the script yourself to see the matrix — see *See it in action* below.

### 4. `docker` — build and push the affected images

This job declares `needs: [verify, schema, matrix]` and runs only `if has_images == 'true'`.
Its strategy block expands the matrix from the previous job, so **each image builds in its own
parallel runner**. For each image it:

- sets `IMAGE_PREFIX` to `ghcr.io/<owner>/lingua` (lowercased — GHCR requires it),
- logs in to GHCR **only on a push** (`if: github.event_name == 'push'`),
- builds with `docker/build-push-action@v6`, using the matrix entry's `file`, `target`, and
  `build_args`, with GitHub Actions layer caching (`cache-from`/`cache-to: type=gha`) scoped
  per image,
- tags the image `:<git-sha>` and `:staging`, and **pushes only on a push to main**
  (`push: ${{ github.event_name == 'push' }}`).

So on a pull request the images are *built* (validating the Dockerfile and warming the cache)
but never published. Publishing happens only when the change lands on `main`.

### 5. `deploy` — Helm upgrade into staging

This is the CD half, and it is deliberately gated. It runs only when **all** of these hold:

```yaml
if: github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.STAGING_ENABLED == 'true'
```

That last condition is the switch: unless the `STAGING_ENABLED` variable is `true` (and the
staging infrastructure and its secrets exist), the deploy is simply skipped — so forks and
contributors without cloud infrastructure still get green `verify`/`schema`/`docker` checks.
A `concurrency: deploy-staging` ensures two deploys never overlap.

When it does run, the job uses the `staging` environment and:

1. writes the kubeconfig from `secrets.STAGING_KUBECONFIG` (base64) and ensures the `lingua`
   namespace exists;
2. creates the `ghcr-pull` Docker-registry secret (so the private cluster can pull GHCR
   images) and the `lingua-secrets` Secret from many `secrets.*` values (managed DB URLs,
   Kafka SASL creds, Keycloak/MinIO/Anthropic creds). These are created out of band so managed
   credentials never enter the Helm release history;
3. runs `helm upgrade --install lingua infra/helm/lingua -f values-staging.yaml -f /tmp/values-ci.yaml`,
   passing the image registry and the exact `imageTag: <git-sha>` plus managed endpoints;
4. runs a **smoke check**: it curls `api.$DOMAIN/health`, `app.$DOMAIN/healthz`, and
   `www.$DOMAIN/` (with retries) and fails the deploy if any does not return `200`.

Where the staging cluster, databases, Kafka, and all those secrets come from is covered in
[./15-terraform.md](./15-terraform.md).

## Key files

- [.github/workflows/ci.yml](../.github/workflows/ci.yml) — the whole pipeline: triggers,
  the five jobs, gating logic, and the staging Helm upgrade.
- [.github/actions/setup-workspace/action.yml](../.github/actions/setup-workspace/action.yml)
  — shared composite action: corepack pnpm, Node 24, frozen install, Nx cache restore.
- [scripts/ci/affected-images.sh](../scripts/ci/affected-images.sh) — computes the affected
  Docker build matrix from `nx affected` + `type:*` project tags.
- `apps/*/project.json` — each app's `tags` array (e.g. `["scope:identity", "type:service"]`)
  is what the matrix script filters on.
- [infra/helm/lingua/values-staging.yaml](../infra/helm/lingua/values-staging.yaml) — the
  overrides the deploy job layers on top of the base Helm values.

## See it in action

**Dry-run the affected-image matrix locally** (no GitHub needed). Pick a base and head and run
the same script CI uses:

```bash
NX_BASE=HEAD~1 NX_HEAD=HEAD DOMAIN=staging.example.com \
  bash scripts/ci/affected-images.sh
```

It prints the JSON matrix (the `{include: [...]}` object the `docker` job consumes) and, on
stderr, a count like `affected images: 2 (has_images=true)`. Change a file under one service
and re-run to watch the matrix shrink to just that image (plus `migrator`).

**See which projects Nx considers affected** between two commits:

```bash
pnpm exec nx show projects --affected --base=origin/main --head=HEAD
```

**Run the verify step locally**, exactly as CI does:

```bash
pnpm exec nx affected -t lint test build --base=origin/main --head=HEAD
```

**Run the schema gate locally:**

```bash
pnpm buf:lint
pnpm buf:breaking
```

**Inspect the live pipeline** with the GitHub CLI:

```bash
gh run list --workflow ci.yml
gh run watch          # follow the most recent run
```

## Related

- [./02-monorepo-nx-pnpm.md](./02-monorepo-nx-pnpm.md) — Nx, the project graph, and what
  "affected" means.
- [./11-docker.md](./11-docker.md) — the parameterised Dockerfiles the `docker` job builds.
- [./12-kubernetes-helm.md](./12-kubernetes-helm.md) — the Helm umbrella the `deploy` job
  installs.
- [./06-grpc-contracts.md](./06-grpc-contracts.md) — the protobuf contracts the `schema` job
  guards.
- [./15-terraform.md](./15-terraform.md) — the managed staging infrastructure and the secrets
  that unlock the `deploy` job.
