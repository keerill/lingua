export interface AuthUser {
  sub: string;
  email: string;
  displayName: string;
  roles: string[];
}

export interface KeycloakClaims {
  sub: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  [claim: string]: unknown;
}

export function claimsToUser(claims: KeycloakClaims): AuthUser {
  return {
    sub: claims.sub,
    email: claims.email ?? '',
    displayName:
      claims.name ?? claims.preferred_username ?? claims.email ?? claims.sub,
    roles: claims.realm_access?.roles ?? [],
  };
}
