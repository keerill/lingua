# 09 — Public Site: Next.js SSR (web-public)

Lingua's marketing site — landing page, scenario catalogue, pricing — is a
separate **Next.js 16** application called **web-public**. It is rendered on the
server, serves crawler-friendly HTML, and is deliberately **not** part of the
Module Federation setup that powers the app UI. This page explains why a public
site needs server-side rendering, what the App Router is, and why this site
stands alone.

## What is it

### Server-side rendering (SSR), and why a marketing site needs it

In a single-page app, the browser downloads a JavaScript bundle and *then* builds
the HTML on the client. That is fine for an authenticated app behind a login, but
it is poor for a public, indexable site:

- Search-engine crawlers and link-preview bots want **HTML in the first
  response** — the title, description, and content already in the markup.
- The page should be fast and meaningful before any JS executes.

**Server-side rendering** runs the React components **on the server** and sends
fully-formed HTML to the browser (which then hydrates it for interactivity). The
result is indexable, shareable HTML — exactly what a landing page and SEO need.

### Next.js App Router

**Next.js** is a React framework with built-in SSR, routing, and its own bundler.
The **App Router** (the `app/` directory) is its modern routing model:

- Each folder under `app/` is a **route**; a `page.tsx` renders it. Components
  are **Server Components** by default — they run on the server and can `await`
  data directly.
- `layout.tsx` wraps routes with shared chrome (header, footer) and exports
  `metadata` for SEO.
- A `[slug]` folder is a **dynamic route** (e.g. one page per scenario).
- Special files `sitemap.ts` and `robots.ts` generate `sitemap.xml` and
  `robots.txt` automatically.

### Why this site is standalone — NOT federated

The app UI uses Module Federation (see [08-frontend-mfe.md](./08-frontend-mfe.md)),
but web-public is intentionally kept out of it:

- **Next.js owns its own SSR pipeline and bundler.** Module Federation 2.0 in
  Lingua is built on Rspack and runs in the browser at runtime; bolting it onto
  Next.js fights Next's server rendering and bundling model.
- **Next.js + Module Federation is not a supported path** in this project — that
  combination is being wound down upstream. Mixing the two would couple the public
  site's release cycle to the app shell and its remotes.
- So web-public shares **nothing at runtime** with the app — no shared React, no
  remotes. The *only* thing it borrows is **TypeScript types** from
  [libs/contracts](../libs/contracts), purely at compile time.

The split is clean: Next.js renders the public, SEO-facing surface; the federated
shell + remotes render the authenticated app. The landing page simply links over
to the app via `APP_URL`.

## How Lingua uses it

### What the site serves

- **Landing** — [apps/web-public/app/page.tsx](../apps/web-public/app/page.tsx):
  hero, feature blurbs, and a live list of conversation scenarios fetched on the
  server.
- **Scenarios index** — [apps/web-public/app/scenarios/page.tsx](../apps/web-public/app/scenarios/page.tsx):
  the catalogue with its own SEO `metadata` and canonical URL.
- **Scenario detail** — [apps/web-public/app/scenarios/[slug]/page.tsx](../apps/web-public/app/scenarios/%5Bslug%5D/page.tsx):
  a dynamic route that `await`s one scenario by slug, builds per-page metadata via
  `generateMetadata`, and calls `notFound()` for unknown slugs.
- **Pricing** — [apps/web-public/app/pricing/page.tsx](../apps/web-public/app/pricing/page.tsx).
- **sitemap.xml** — [apps/web-public/app/sitemap.ts](../apps/web-public/app/sitemap.ts):
  static routes plus one entry per scenario.
- **robots.txt** — [apps/web-public/app/robots.ts](../apps/web-public/app/robots.ts):
  allows all crawlers and points at the sitemap.
- **SEO metadata** — [apps/web-public/app/layout.tsx](../apps/web-public/app/layout.tsx)
  sets a `metadataBase`, title template, description, and Open Graph / Twitter
  tags for the whole site.

### Sharing only `libs/contracts` types

The site pulls scenario data from svc-content's **public** API and types the
response with shared contracts — see
[apps/web-public/lib/content.ts](../apps/web-public/lib/content.ts):

```ts
import type { ScenarioSummary } from '@lingua/contracts';

const API = process.env.CONTENT_PUBLIC_API_URL ?? 'http://localhost:3106';
// fetched server-side, cache: 'no-store', with a safe [] / null fallback
export const getScenarios = (): Promise<ScenarioSummary[]> =>
  safeGet<ScenarioSummary[]>('/public/scenarios', []);
```

`ScenarioSummary` is the only thing imported from `@lingua/contracts`, and it
disappears at runtime — it is a compile-time type, not shipped code. To let Next
import those types from outside its own directory in the Nx workspace,
`next.config.mjs` enables `experimental.externalDir`. The fetches are wrapped in a
`safeGet` that returns an empty list / `null` on failure, so the site still
renders if svc-content is down.

### Build and runtime config

[apps/web-public/next.config.mjs](../apps/web-public/next.config.mjs) sets:

- `output: 'standalone'` — Next traces its dependencies and emits a self-contained
  `server.js`, ideal for a small Docker image. `next dev` is unaffected.
- `outputFileTracingRoot` pointed at the monorepo root so pnpm-linked deps are
  traced correctly.
- `reactStrictMode: true`.

Nx targets in [apps/web-public/project.json](../apps/web-public/project.json) wrap
the Next CLI: `serve` → `next dev -p 4205`, `build` → `next build`, `start` →
`next start -p 4205`. The project is tagged `type:web-ssr` / `scope:public`.

## Key files

| File | Role |
| --- | --- |
| [apps/web-public/next.config.mjs](../apps/web-public/next.config.mjs) | `output: 'standalone'`, `externalDir` for `@lingua/contracts`, tracing root |
| [apps/web-public/project.json](../apps/web-public/project.json) | Nx targets: `serve`/`build`/`start` wrapping the Next CLI (port 4205) |
| [apps/web-public/app/layout.tsx](../apps/web-public/app/layout.tsx) | Root layout, site-wide SEO `metadata`, header/footer |
| [apps/web-public/app/page.tsx](../apps/web-public/app/page.tsx) | Landing page (server-rendered scenario list) |
| [apps/web-public/app/scenarios/page.tsx](../apps/web-public/app/scenarios/page.tsx) | Scenario catalogue |
| [apps/web-public/app/scenarios/[slug]/page.tsx](../apps/web-public/app/scenarios/%5Bslug%5D/page.tsx) | Dynamic per-scenario page + `generateMetadata` |
| [apps/web-public/app/pricing/page.tsx](../apps/web-public/app/pricing/page.tsx) | Pricing page |
| [apps/web-public/app/sitemap.ts](../apps/web-public/app/sitemap.ts) | Generates `sitemap.xml` |
| [apps/web-public/app/robots.ts](../apps/web-public/app/robots.ts) | Generates `robots.txt` |
| [apps/web-public/lib/content.ts](../apps/web-public/lib/content.ts) | Server-side fetch of svc-content public API, typed via `@lingua/contracts` |
| [apps/web-public/lib/config.ts](../apps/web-public/lib/config.ts) | `APP_URL` link out to the federated shell |

## See it in action

```bash
# Dev server with hot reload
pnpm nx serve web-public        # http://localhost:4205

# Production-style standalone build, then run it
pnpm nx build web-public
pnpm nx start web-public        # http://localhost:4205
```

Verify SSR and SEO output (note HTML — not an empty JS shell — comes back):

```bash
curl -s http://localhost:4205/ | grep -i '<title>'
curl -s http://localhost:4205/sitemap.xml
curl -s http://localhost:4205/robots.txt
```

The scenario catalogue is populated only when svc-content is running and seeded
(its public API on port 3106); otherwise the pages render with their safe empty
fallbacks. The header's **Open the app →** link points at the shell at
`http://localhost:4200`.

## Related

- [08-frontend-mfe.md](./08-frontend-mfe.md) — the federated app UI this site links to and is *not* part of
- [03-backend-nestjs.md](./03-backend-nestjs.md) — svc-content, the source of scenario data
- [06-grpc-contracts.md](./06-grpc-contracts.md) — `@lingua/contracts`, the only thing shared with this site
- [11-docker.md](./11-docker.md) — the standalone Next image build
