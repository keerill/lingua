# 02 — Monorepo, Nx and pnpm

Lingua keeps every app and shared library in a single repository, built and tested with
Nx and installed with pnpm. This document explains what that means and the handful of
commands you will actually use day to day.

## What is it

### Monorepo

A **monorepo** ("mono" = one) is a single Git repository that holds *many* projects
instead of one project per repo. Lingua's repo contains 9 backend services, 5
frontends, a public site, and several shared libraries — all together.

Why bother?

- **One source of truth.** All projects share one set of dependency versions, one
  TypeScript config, one lint setup. No "service A is on React 18, service B on React 19."
- **Atomic cross-cutting changes.** If you change a shared type, you change every consumer
  in the *same commit*. Nothing drifts out of sync.
- **Code sharing without publishing.** Shared code lives in [libs/](../libs) and is
  imported directly; you never publish a package to a registry and bump versions.

The risk of a monorepo is that it can become slow — running *every* test on *every*
commit doesn't scale. That is the problem Nx solves.

### Nx

**Nx** is a build system for monorepos. It understands the relationships between your
projects and uses that knowledge to do less work. Four features matter:

1. **Project graph.** Nx scans imports and builds a dependency graph: it knows that
   `svc-learning` depends on `@lingua/contracts`, that `shell` depends on the mfe
   remotes, and so on.
2. **Task running.** Instead of `cd`-ing into each project, you run one command and Nx
   runs the matching *target* (`build`, `test`, `serve`…) across many projects, in the
   right order, in parallel.
3. **Caching.** When Nx runs a target it hashes all the inputs (source files, config,
   dependencies). If nothing changed, it replays the previous result instantly instead of
   re-running. In [nx.json](../nx.json) the `build` and `test` targets have
   `"cache": true`.
4. **`nx affected`.** Using the project graph plus Git, Nx computes *only the projects
   touched by your change* (and everything downstream of them) and runs targets on just
   those. On a big repo this is the difference between a 30-second CI run and a 30-minute
   one.

### pnpm

**pnpm** is the package manager (the thing that installs `node_modules`). Lingua uses it
instead of npm for two reasons:

- **Workspaces.** pnpm natively links the projects inside the repo to each other. Because
  of this, `apps/svc-learning` can `import { Topics } from '@lingua/contracts'` and pnpm
  wires that name to [libs/contracts](../libs/contracts) on disk — no publishing.
- **A single content-addressable store.** pnpm stores each package version once on your
  machine and hard-links it into each project, so installs are fast and disk-cheap.

The exact pnpm version is pinned in [package.json](../package.json):

```json
"packageManager": "pnpm@11.5.2"
```

That line is read by **corepack**, a tool bundled with Node. Running `corepack enable`
once makes the `pnpm` command resolve to *exactly* the pinned version — so everyone on
the team and CI uses the same package manager, automatically. (Do not use `npm` here.)

### Node version pinning

The Node version is pinned in two places so nobody runs the wrong runtime:

- [.nvmrc](../.nvmrc) contains `24` — tools like `nvm`/`fnm` read this to switch versions.
- [package.json](../package.json) declares `"engines": { "node": ">=24" }`.

## How Lingua uses it

### The workspace layout

[pnpm-workspace.yaml](../pnpm-workspace.yaml) declares which folders are projects:

```yaml
packages:
  - 'apps/*'
  - 'libs/*'
```

So every folder under `apps/` and `libs/` is an independent workspace package. Each one
has a `project.json` (its Nx targets) and a `package.json` (its name and dependencies).

### How `@lingua/*` imports resolve

Shared libraries are referenced by stable names — `@lingua/contracts`, `@lingua/kafka`,
`@lingua/auth`, `@lingua/grpc`, `@lingua/observability`. These names are mapped to real
files by the TypeScript path aliases in [tsconfig.base.json](../tsconfig.base.json):

```json
"paths": {
  "@lingua/contracts":         ["libs/contracts/src/index.ts"],
  "@lingua/contracts/proto":   ["libs/contracts/src/generated/index.ts"],
  "@lingua/kafka":             ["libs/kafka/src/index.ts"],
  "@lingua/grpc":              ["libs/grpc/src/index.ts"],
  "@lingua/auth":              ["libs/auth/src/index.ts"],
  "@lingua/observability":     ["libs/observability/src/index.ts"]
}
```

These aliases point straight at the library's **TypeScript source**, not a compiled
build. That matters because dev and build resolve them differently:

| Mode | Tool | What happens |
|---|---|---|
| **Dev** (`serve`) | `@swc-node/register` (SWC) | TypeScript is transpiled on the fly, in memory, as files are imported. No build step; edit a lib and the importing service picks it up. |
| **Build** | `tsc` | The TypeScript compiler resolves the same `@lingua/*` aliases and emits compiled output. |

You can see the dev mode in the service's serve target — for example
[apps/svc-learning/project.json](../apps/svc-learning/project.json):

```json
"serve": {
  "executor": "nx:run-commands",
  "options": {
    "command": "node --env-file=../../.env --watch -r @swc-node/register src/main.ts"
  }
}
```

The `-r @swc-node/register` hook is what lets Node run `.ts` files (and resolve the
`@lingua/*` aliases) directly, with `--watch` for hot restart. The matching `build` target
in the same file runs `tsc -p tsconfig.app.json` — the real compile.

Frontends differ: the `shell` build/serve uses Rspack, not `tsc` — see
[apps/shell/project.json](../apps/shell/project.json):

```json
"build": { "command": "rspack build -c rspack.config.cjs" },
"serve": { "command": "rspack serve -c rspack.config.cjs" }
```

### The allowBuilds policy

Since pnpm v10, packages are **not** allowed to run install/build scripts by default —
a supply-chain safety measure (a malicious package can't run arbitrary code on
`pnpm install`). But some legitimate native packages genuinely need to build on install.
Lingua opts those in explicitly in [pnpm-workspace.yaml](../pnpm-workspace.yaml):

```yaml
allowBuilds:
  '@bufbuild/buf': true
  '@confluentinc/kafka-javascript': true
  '@prisma/client': true
  '@prisma/engines': true
  '@swc/core': true
  esbuild: true
  nx: true
  prisma: true
  protobufjs: true
  ...
```

The same file also sets `minimumReleaseAge: 0`, which disables pnpm's "wait N days before
using a freshly published version" gate — Lingua deliberately pins the latest stable
patches.

### Targets, inputs, and caching

Project-wide defaults live in [nx.json](../nx.json):

- `targetDefaults.build` and `.test` set `"cache": true` and `dependsOn: ["^build"]`.
  The `^build` means "before building/testing me, build my dependencies first" — so when
  you test `svc-learning`, Nx builds `@lingua/contracts` first.
- `namedInputs.production` excludes `*.spec.ts`/`*.test.ts` and jest config, so changing a
  test file does **not** invalidate the production build cache.
- The `@nx/jest/plugin` plugin auto-creates a `test` target for every project that has a
  Jest config — that is why you rarely see `test` written out in a `project.json`.

## Key files

| Path | What it controls |
|---|---|
| [nx.json](../nx.json) | Nx target defaults, caching, named inputs, plugins. |
| [package.json](../package.json) | Root scripts, `packageManager` (pnpm version), `engines` (Node). |
| [pnpm-workspace.yaml](../pnpm-workspace.yaml) | Which folders are packages, `allowBuilds`, `minimumReleaseAge`. |
| [tsconfig.base.json](../tsconfig.base.json) | The `@lingua/*` path aliases shared by every project. |
| [.nvmrc](../.nvmrc) | Pinned Node version (`24`). |
| [apps/svc-learning/project.json](../apps/svc-learning/project.json) | Example service targets (SWC dev serve, `tsc` build, Prisma, Jest). |
| [apps/shell/project.json](../apps/shell/project.json) | Example frontend targets (Rspack build/serve). |

## See it in action

```bash
# One-time: make corepack use the pinned pnpm, then install everything.
corepack enable
pnpm install

# Run a single target on a single project.
pnpm nx run svc-learning:build
pnpm nx run svc-learning:serve

# Run a target across ALL projects (in dependency order, with caching).
pnpm nx run-many -t build
pnpm nx run-many -t test
pnpm nx run-many -t serve --parallel=16   # also: pnpm serve (see package.json scripts)

# Run targets only on projects affected by your uncommitted/branch changes.
pnpm nx affected -t lint test build

# Visualize the project dependency graph in the browser.
pnpm nx graph
```

The root [package.json](../package.json) wraps the common ones as scripts:

```json
"scripts": {
  "build": "nx run-many -t build",
  "test":  "nx run-many -t test",
  "serve": "nx run-many -t serve --parallel=12"
}
```

To *feel* the cache, run a build twice — the second run reports cached results and
finishes almost instantly:

```bash
pnpm nx run-many -t build
pnpm nx run-many -t build   # "Nx read the output from the cache instead of running..."
```

## Related

- [./01-architecture.md](./01-architecture.md) — what all these projects actually are.
- [./03-backend-nestjs.md](./03-backend-nestjs.md) — the structure inside a backend project.
- [./11-docker.md](./11-docker.md) — how projects are packaged into images.
- [./14-ci-cd.md](./14-ci-cd.md) — how `nx affected` drives the CI pipeline.
- [../README.md](../README.md) and [./QUICKSTART.md](./QUICKSTART.md) — full setup.

External reading:

- [Nx documentation](https://nx.dev)
- [pnpm workspaces](https://pnpm.io/workspaces)
- [Node corepack](https://nodejs.org/api/corepack.html)
