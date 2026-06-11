# 08 — Frontend: Micro-Frontends & Module Federation

Lingua's app UI is not one big React bundle. It is a **host shell** plus four
independently built **remote** apps stitched together in the browser at runtime
with **Module Federation 2.0**. This page explains what micro-frontends are, how
Module Federation wires them, why Lingua uses Rspack, and the MVVM convention
every micro-frontend follows.

## What is it

### Micro-frontends

A **micro-frontend** applies the micro-services idea to the browser: split one
large frontend into smaller apps, each owned by a feature team, each built and
deployed on its own cadence. Lingua's split mirrors its backend domains:

- **shell** — the host: top-level routing, header, auth, role gating.
- **mfe-learner** — decks, cards, review (SRS).
- **mfe-speaking** — real-time conversation practice.
- **mfe-progress** — charts and stats (uses Recharts).
- **mfe-studio** — admin content authoring (admin-only).

The win is isolation: `mfe-progress` can be rebuilt and redeployed without
touching `mfe-learner`. The challenge — keeping them from each shipping their own
copy of React — is exactly what Module Federation solves.

### Module Federation 2.0

**Module Federation (MF)** lets one bundle import code from another bundle that
was **built and deployed separately**, loaded over the network **at runtime** —
not bundled together at build time. Key concepts:

- **Host** — the app that consumes remotes (the shell).
- **Remote** — an app that **exposes** modules for others to import (each `mfe-*`).
- **Exposes** — the explicit list of modules a remote publishes, e.g.
  `mfe-learner` exposes `./LearnerApp`.
- **Shared singletons** — dependencies marked `singleton` (React, ReactDOM,
  React Router, TanStack Query) so the host and every remote use **one** instance
  at runtime. Two React copies would break hooks and context; `singleton: true`
  guarantees one.
- **Runtime manifest** — MF 2.0 publishes an `mf-manifest.json` (and a
  `remoteEntry.js`) describing a remote's exposes and shared deps. The host reads
  the manifest at runtime to resolve and load remotes; nothing about the remotes
  is baked into the host at build time, so a remote can be redeployed independently.

### Why Rspack, not Vite-federation

Lingua standardises on **Rspack** (`@rspack/core`, a Rust-based, webpack-compatible
bundler) with **`@module-federation/enhanced/rspack`** — the official MF 2.0
plugin. This is a hard rule for the project:

- MF 2.0's `enhanced` plugin is first-class on webpack/Rspack and gives the
  runtime manifest, version negotiation, and shared-singleton handling Lingua
  relies on. Vite's federation plugins are a separate, less complete ecosystem.
- Next.js + MF is also explicitly avoided (its MF support is being wound down);
  Next.js is used only for the standalone public site — see [09-web-public-next.md](./09-web-public-next.md).

## How Lingua uses it

### The host: shell

[apps/shell/rspack.config.cjs](../apps/shell/rspack.config.cjs) registers four
remotes by pointing at each remote's runtime manifest and declares the shared
singletons:

```js
new ModuleFederationPlugin({
  name: 'shell',
  remotes: {
    mfe_learner:  `mfe_learner@${LEARNER_REMOTE}`,   // .../4201/mf-manifest.json
    mfe_speaking: `mfe_speaking@${SPEAKING_REMOTE}`,  // .../4202/mf-manifest.json
    mfe_progress: `mfe_progress@${PROGRESS_REMOTE}`,  // .../4203/mf-manifest.json
    mfe_studio:   `mfe_studio@${STUDIO_REMOTE}`,      // .../4204/mf-manifest.json
  },
  shared, // react, react-dom, react-router-dom, @tanstack/react-query — all singleton
});
```

The shell serves on port **4200** with `publicPath: '/'` so host assets resolve
from the root at any route depth (e.g. `/auth/callback` still loads `/main.js`).

### A remote: mfe-learner

[apps/mfe-learner/rspack.config.cjs](../apps/mfe-learner/rspack.config.cjs)
exposes one module and declares the **same** shared singletons so it joins the
host's React instance rather than shipping its own:

```js
new ModuleFederationPlugin({
  name: 'mfe_learner',
  filename: 'remoteEntry.js',
  exposes: { './LearnerApp': './src/LearnerApp.tsx' },
  shared, // identical singleton set as the host
});
```

The host imports the remote lazily, so each remote loads only when its route is
hit — see [apps/shell/src/app.tsx](../apps/shell/src/app.tsx):

```tsx
const LearnerApp  = lazy(() => import('mfe_learner/LearnerApp'));
const SpeakingApp = lazy(() => import('mfe_speaking/SpeakingApp'));
const ProgressApp = lazy(() => import('mfe_progress/ProgressApp'));
const StudioApp   = lazy(() => import('mfe_studio/StudioApp'));
```

### Routing and role gating

The shell owns top-level routes with **React Router 7**
([apps/shell/src/app.tsx](../apps/shell/src/app.tsx)). Each protected route is
wrapped so unauthenticated users bounce home, and the admin route additionally
checks the role:

```tsx
function ProtectedStudio() {
  const { authenticated, api, roles } = useAuth();
  if (!authenticated || !roles.includes('admin'))
    return <Navigate to="/" replace />;
  return <Suspense fallback={...}><StudioApp api={api} /></Suspense>;
}
```

The shell passes the authenticated `api()` fetch helper (and, for speaking, the
access token) **down into the remote as a prop**, so remotes never re-implement
auth. The header likewise only renders the Studio link for admins
([apps/shell/src/ui/header.tsx](../apps/shell/src/ui/header.tsx)). Roles come
from the JWT via `useAuth()` — see [07-auth-keycloak.md](./07-auth-keycloak.md).

### The bootstrap split

Each app's `main.ts` does a single dynamic import of `./bootstrap`
([apps/shell/src/main.ts](../apps/shell/src/main.ts)). This async boundary is
required by Module Federation: it lets the shared-dependency runtime initialise
*before* React is imported. The real mounting happens in
[apps/shell/src/bootstrap.tsx](../apps/shell/src/bootstrap.tsx) (and each
remote's `bootstrap.tsx`).

### MVVM: model/ ViewModels, ui/ pure views, SCSS Modules

Every micro-frontend follows **MVVM**, separating data/logic from presentation:

- **`model/`** holds **ViewModel hooks** that own all state, queries, and
  mutations via **TanStack Query**. Example:
  [apps/mfe-learner/src/model/view-models/use-decks.view-model.ts](../apps/mfe-learner/src/model/view-models/use-decks.view-model.ts)
  exposes `decks`, `isLoading`, `error`, `title`, `submitDeck`, etc. The data
  layer (`useQuery`/`useMutation`) lives here, behind a typed API client in
  [model/api.tsx](../apps/mfe-learner/src/model/api.tsx) that returns
  `@lingua/contracts` types.
- **`ui/`** holds **pure View components** that consume a ViewModel hook and only
  render. Example:
  [apps/mfe-learner/src/ui/decks/decks-screen.tsx](../apps/mfe-learner/src/ui/decks/decks-screen.tsx)
  is just `const vm = useDecksViewModel()` plus JSX — no fetching, no business
  logic.
- **SCSS Modules, no inline styles.** Each view imports a colocated
  `*.module.scss` whose class names are scoped at build time, e.g.
  [apps/mfe-learner/src/ui/decks/decks-screen.module.scss](../apps/mfe-learner/src/ui/decks/decks-screen.module.scss),
  used as `className={styles.screen}`. The Rspack configs register SCSS Modules
  via `type: 'css/module'` + `sass-loader`.

This split keeps Views trivial to read and ViewModels trivial to test in
isolation.

## Key files

| File | Role |
| --- | --- |
| [apps/shell/rspack.config.cjs](../apps/shell/rspack.config.cjs) | Host MF config: `remotes`, shared singletons, SCSS Modules |
| [apps/mfe-learner/rspack.config.cjs](../apps/mfe-learner/rspack.config.cjs) | Remote MF config: `exposes`, `remoteEntry.js`, shared singletons |
| [apps/shell/src/app.tsx](../apps/shell/src/app.tsx) | React Router 7 routes, lazy remote loading, route protection + role gating |
| [apps/shell/src/main.ts](../apps/shell/src/main.ts) + [bootstrap.tsx](../apps/shell/src/bootstrap.tsx) | Async bootstrap boundary required by MF |
| [apps/shell/src/ui/header.tsx](../apps/shell/src/ui/header.tsx) | Nav with role-conditional Studio link |
| [apps/mfe-learner/src/LearnerApp.tsx](../apps/mfe-learner/src/LearnerApp.tsx) | The exposed remote entry component |
| [apps/mfe-learner/src/model/](../apps/mfe-learner/src/model) | ViewModels + typed API client (TanStack Query) |
| [apps/mfe-learner/src/ui/](../apps/mfe-learner/src/ui) | Pure views + `*.module.scss` |
| [apps/mfe-learner/src/bootstrap.tsx](../apps/mfe-learner/src/bootstrap.tsx) | Standalone dev mount (router `basename="/app"`) |

Ports: shell **4200**, mfe-learner **4201**, mfe-speaking **4202**,
mfe-progress **4203**, mfe-studio **4204** (overridable via `*_PORT` /
`MFE_*_REMOTE` env vars in the configs).

## See it in action

Run the host together with the remotes (each via its Nx `serve` target, which
runs `rspack serve`):

```bash
# Start every remote, then the host (order does not matter — the host fetches
# manifests at runtime)
pnpm nx serve mfe-learner   # http://localhost:4201
pnpm nx serve mfe-speaking  # http://localhost:4202
pnpm nx serve mfe-progress  # http://localhost:4203
pnpm nx serve mfe-studio    # http://localhost:4204
pnpm nx serve shell         # http://localhost:4200

# Inspect a remote's runtime manifest the host consumes:
curl -s http://localhost:4201/mf-manifest.json | jq .
```

Open `http://localhost:4200`, log in, and navigate — each tab lazy-loads its
remote from the corresponding port.

**A remote runs standalone, too.** Each `mfe-*` has its own
`bootstrap.tsx` that mounts the exposed app directly with its own
`BrowserRouter` (e.g. `basename="/app"`) and a plain `fetch`-based `api()`. So
`pnpm nx serve mfe-learner` and opening `http://localhost:4201` renders the
learner app on its own, with no shell — handy for developing one micro-frontend
in isolation.

## Related

- [02-monorepo-nx-pnpm.md](./02-monorepo-nx-pnpm.md) — how Nx builds and serves these apps
- [07-auth-keycloak.md](./07-auth-keycloak.md) — the `useAuth()` access token and roles the shell injects
- [09-web-public-next.md](./09-web-public-next.md) — the public site that is deliberately *not* federated
- [06-grpc-contracts.md](./06-grpc-contracts.md) — `@lingua/contracts`, the shared TS types the frontends consume
