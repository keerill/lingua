/**
 * The authenticated principal extracted from a validated Keycloak access token.
 * We never mint our own JWT — Keycloak is the issuer; services only validate.
 */
export interface AuthUser {
  /** Keycloak `sub` — the stable user id used as the primary key everywhere. */
  sub: string;
  email: string;
  displayName: string;
  roles: string[];
}

/** Shape of the Keycloak access-token claims we rely on. */
export interface KeycloakClaims {
  sub: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  [claim: string]: unknown;
}

/** Map raw Keycloak claims into our internal {@link AuthUser}. */
export function claimsToUser(claims: KeycloakClaims): AuthUser {
  return {
    sub: claims.sub,
    email: claims.email ?? '',
    displayName: claims.name ?? claims.preferred_username ?? claims.email ?? claims.sub,
    roles: claims.realm_access?.roles ?? [],
  };
}
