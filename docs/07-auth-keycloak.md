# 07 — Authentication: OAuth2, OpenID Connect & Keycloak

Lingua never invents its own login system. It delegates identity to **Keycloak**,
an open-source identity server, and speaks two standard protocols to it:
**OAuth2** (authorization) and **OpenID Connect** (authentication, layered on
OAuth2). Every protected request that reaches a backend service carries a
short-lived **JWT access token** that the service verifies on its own — Lingua
issues no tokens of its own.

This page builds the picture from first principles, then walks the exact flow
this repo implements.

## What is it

### OAuth2 and OpenID Connect in plain terms

- **OAuth2** is a protocol for *delegated access*: a user lets an application act
  on their behalf without handing over their password. The application receives
  a **token** instead.
- **OpenID Connect (OIDC)** adds *identity* on top of OAuth2: besides "what may
  this app do", it answers "who is this user". Keycloak is an OIDC provider.

Two tokens matter:

- **Access token** — short-lived (here **300 seconds**, see `accessTokenLifespan`
  in the realm). It is a **JWT**: a signed JSON blob with claims like `sub` (user
  id), `email`, and roles. A service trusts it because it is signed by Keycloak
  and the service can check that signature. Sent on every API call as
  `Authorization: Bearer <token>`.
- **Refresh token** — longer-lived. It is *not* used to call APIs; its only job is
  to ask Keycloak for a fresh access token when the old one expires, without
  forcing the user to log in again.

### The Authorization Code flow + PKCE

The **Authorization Code flow** is the OAuth2 flow for interactive logins:

1. The app redirects the browser to Keycloak's login page.
2. The user authenticates at Keycloak (the app never sees the password).
3. Keycloak redirects back with a one-time **authorization code**.
4. The app exchanges that code (server-to-server) for tokens.

**PKCE** ("pixie", Proof Key for Code Exchange) hardens step 4 against a stolen
code. Before redirecting, the app generates a random `code_verifier`, hashes it
(`SHA-256` → `code_challenge`), and sends only the hash to Keycloak. At exchange
time it presents the original verifier; Keycloak re-hashes and compares. A code
intercepted in transit is useless without the matching verifier. Lingua uses the
`S256` challenge method (see `pkce.code.challenge.method` in the realm).

```
 Browser (shell SPA)        gateway-bff              Keycloak
        |                        |                       |
        |  click "Log in"        |                       |
        | ---------------------> |                       |
        |   GET /auth/login      |                       |
        |                        | make verifier+challenge
        |                        | set httpOnly cookies  |
        |   302 to Keycloak auth (code_challenge, state) |
        | <--------------------- |                       |
        |  user logs in -------------------------------> |
        |                        |                       |
        |  302 back: ?code&state |                       |
        | <--------------------------------------------- |
        |  GET /auth/callback    |                       |
        | ---------------------> |                       |
        |                        | exchange code+verifier|
        |                        | --------------------> |
        |                        |   access + refresh    |
        |                        | <-------------------- |
        |  302: refresh in        |                      |
        |  httpOnly cookie,       |                      |
        |  access token in #hash  |                      |
        | <--------------------- |                       |
```

### Keycloak vocabulary

- **Realm** — an isolated tenant of users, roles, and clients. Lingua's realm is
  `lingua`, imported from [infra/docker/keycloak/realm-export.json](../infra/docker/keycloak/realm-export.json).
- **Client** — an application registered with the realm. A **public** client
  (the SPA, `lingua-shell`) has no secret and must use PKCE. A **confidential**
  client (`lingua-bff`) holds a secret and can authenticate itself to Keycloak.
- **Roles** — `learner` and `admin` in this realm. They ride inside the access
  token under `realm_access.roles`.
- **JWKS** — the JSON Web Key Set: Keycloak's public signing keys, published at
  `/.well-known` / `/protocol/openid-connect/certs`. Services fetch these keys to
  verify token signatures without ever calling Keycloak per-request.

The realm ships two test users: **learner / learner** (role `learner`) and
**admin / admin** (roles `learner` + `admin`).

## How Lingua uses it

### A BFF-mediated PKCE flow

The browser runs a single-page app (the **shell**), but Lingua does **not** run
the token exchange in the browser. Instead the **gateway-bff** acts as a
*Backend-For-Frontend* and runs the PKCE flow server-side. This keeps the refresh
token off the JavaScript heap entirely.

Step by step (all in [apps/gateway-bff/src/interface/http/auth.controller.ts](../apps/gateway-bff/src/interface/http/auth.controller.ts)
and [apps/gateway-bff/src/infrastructure/auth/keycloak-oidc.service.ts](../apps/gateway-bff/src/infrastructure/auth/keycloak-oidc.service.ts)):

1. **`GET /auth/login`** — the BFF calls `createPkce()` (random `verifier`,
   `SHA-256` `challenge`) and `createState()` (CSRF guard). It stores both
   `verifier` and `state` in **httpOnly cookies** (`lingua_pkce`, `lingua_state`),
   then redirects the browser to Keycloak's `/auth` endpoint with the
   `code_challenge`, `code_challenge_method=S256`, and `scope=openid profile email`.
2. **`GET /auth/callback`** — Keycloak redirects back with `code` and `state`.
   The BFF checks `state` matches the cookie, then calls `exchangeCode()`:
   a server-to-server POST to Keycloak's token endpoint sending the `code`, the
   `code_verifier` from the cookie, and the **confidential client secret**
   (`lingua-bff` / `lingua-bff-secret`). Keycloak returns the access + refresh
   tokens.
3. The BFF verifies the access token, calls `identity.sync(...)` to upsert the
   user into svc-identity, clears the PKCE/state cookies, stores the **refresh
   token in an httpOnly cookie** (`lingua_rt`), and redirects to the shell with
   the **access token in the URL fragment** (`#access_token=...`).
4. **`POST /auth/refresh`** — reads the `lingua_rt` cookie, swaps it for a fresh
   token pair, rotates the cookie, and returns the new access token as JSON.
5. **`POST /auth/logout`** — revokes the refresh token at Keycloak and clears the
   cookie.

### Why access token in memory, refresh token in an httpOnly cookie

- The **refresh token is the long-lived secret** — if stolen it can mint access
  tokens for the whole session. Putting it in an **httpOnly** cookie means
  JavaScript (and therefore any XSS payload) cannot read it; only the browser
  attaches it to BFF requests. The shell never sees it.
- The **access token is short-lived (5 min)** and is handed to the SPA via the URL
  fragment, then held only in React state. The shell keeps it in memory and sends
  it as `Authorization: Bearer` (see [apps/shell/src/model/auth/auth-context.tsx](../apps/shell/src/model/auth/auth-context.tsx)).
  On startup, or on a `401`, the shell silently calls `/auth/refresh`
  (`credentials: 'include'` so the cookie travels) to get a new one. The blast
  radius of a leaked access token is one short window.

The shell decodes roles directly from the JWT payload (`decodeRoles`) only to
drive the UI; the real authorization decisions happen server-side.

### Verifying tokens against JWKS — `libs/auth`

Every backend service validates tokens **locally** using the shared
[libs/auth](../libs/auth/src) library — there is no per-request round-trip to
Keycloak.

- [libs/auth/src/jwt-verifier.ts](../libs/auth/src/jwt-verifier.ts) — `KeycloakJwtVerifier`
  uses `jose`'s `createRemoteJWKSet` to fetch and cache Keycloak's public keys,
  then `jwtVerify` checks the signature and the `issuer`
  (`<KEYCLOAK_URL>/realms/<realm>`). On success it maps Keycloak claims to a small
  `AuthUser` (`sub`, `email`, `displayName`, `roles`) via `claimsToUser`.
- [libs/auth/src/nest/auth.module.ts](../libs/auth/src/nest/auth.module.ts) —
  `AuthModule.forRoot({ authServerUrl, realm })` is a global module that binds the
  verifier and the two guards. The BFF wires it in
  [apps/gateway-bff/src/gateway.module.ts](../apps/gateway-bff/src/gateway.module.ts).
- [libs/auth/src/nest/jwt-auth.guard.ts](../libs/auth/src/nest/jwt-auth.guard.ts) —
  `JwtAuthGuard` pulls the bearer token, verifies it, and stashes the `AuthUser`
  on the request. A missing or invalid token → `401`.
- [libs/auth/src/nest/roles.guard.ts](../libs/auth/src/nest/roles.guard.ts) +
  [roles.decorator.ts](../libs/auth/src/nest/roles.decorator.ts) — `@Roles('admin')`
  attaches required roles as metadata; `RolesGuard` reads it and `403`s if the
  user lacks them. Studio is admin-only:
  [studio.controller.ts](../apps/gateway-bff/src/interface/http/studio.controller.ts)
  is annotated `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')`.
- [libs/auth/src/nest/current-user.decorator.ts](../libs/auth/src/nest/current-user.decorator.ts) —
  `@CurrentUser()` injects the verified `AuthUser` into a handler, e.g.
  [me.controller.ts](../apps/gateway-bff/src/interface/http/me.controller.ts)
  returns the caller's own identity.

### WebSocket handshake validation (speaking)

Browsers cannot set an `Authorization` header on a WebSocket. So the speaking
gateway validates the token during the **HTTP upgrade handshake** instead:
[apps/gateway-bff/src/interface/ws/realtime.gateway.ts](../apps/gateway-bff/src/interface/ws/realtime.gateway.ts)
handles the `upgrade` event for path `/realtime/speaking`, reads the access token
from either the `?token=` query param or the `Sec-WebSocket-Protocol` header,
and runs it through the same `KeycloakJwtVerifier`. If verification fails it
writes `401 Unauthorized` and destroys the socket before any frames flow; if it
succeeds the connection is bound to that `AuthUser` for the session.

## Key files

| File | Role |
| --- | --- |
| [infra/docker/keycloak/realm-export.json](../infra/docker/keycloak/realm-export.json) | Realm, clients (`lingua-shell` public/PKCE, `lingua-bff` confidential), roles, test users |
| [libs/auth/src/jwt-verifier.ts](../libs/auth/src/jwt-verifier.ts) | JWKS-based JWT verification with `jose` |
| [libs/auth/src/auth-user.ts](../libs/auth/src/auth-user.ts) | Keycloak claims → `AuthUser` mapping |
| [libs/auth/src/nest/](../libs/auth/src/nest) | `AuthModule`, `JwtAuthGuard`, `RolesGuard`, `@Roles`, `@CurrentUser` |
| [apps/gateway-bff/src/interface/http/auth.controller.ts](../apps/gateway-bff/src/interface/http/auth.controller.ts) | `/auth/login`, `/callback`, `/refresh`, `/logout` |
| [apps/gateway-bff/src/infrastructure/auth/keycloak-oidc.service.ts](../apps/gateway-bff/src/infrastructure/auth/keycloak-oidc.service.ts) | PKCE creation, auth-URL building, token endpoint calls |
| [apps/gateway-bff/src/interface/ws/realtime.gateway.ts](../apps/gateway-bff/src/interface/ws/realtime.gateway.ts) | WebSocket handshake token validation |
| [apps/shell/src/model/auth/auth-context.tsx](../apps/shell/src/model/auth/auth-context.tsx) | SPA auth state: in-memory access token, silent refresh, `api()` fetch |

The relevant environment variables (see `.env.example`):

```
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=lingua
KEYCLOAK_BFF_CLIENT_ID=lingua-bff
KEYCLOAK_BFF_CLIENT_SECRET=lingua-bff-secret
BFF_PUBLIC_URL=http://localhost:3000
SHELL_PUBLIC_URL=http://localhost:4200
```

## See it in action

With the stack running (see [QUICKSTART.md](./QUICKSTART.md)):

```bash
# Keycloak admin console — realm "lingua", clients, users
open http://localhost:8080

# Inspect the public signing keys (JWKS) a service uses to verify tokens
curl -s http://localhost:8080/realms/lingua/protocol/openid-connect/certs | jq .

# Kick off the login flow from the BFF (redirects to Keycloak)
open http://localhost:3000/auth/login
```

Then in the browser:

1. Open the shell at `http://localhost:4200` and click **Log in**.
2. Sign in as `learner` / `learner` (or `admin` / `admin`).
3. After the redirect, `GET http://localhost:3000/me` (with the bearer token, via
   the shell's `api()` helper) returns your `AuthUser`.
4. Log in as `learner` and the **Studio** link is hidden; the admin-only routes
   return `403`. Log in as `admin` to unlock them.

## Related

- [01-architecture.md](./01-architecture.md) — where the BFF and services sit
- [03-backend-nestjs.md](./03-backend-nestjs.md) — guards, modules, hexagonal layout
- [08-frontend-mfe.md](./08-frontend-mfe.md) — how the shell consumes the access token and gates routes by role
- [10-ai-speech.md](./10-ai-speech.md) — the speaking turn behind the authenticated WebSocket
- [11-docker.md](./11-docker.md) — running Keycloak locally
