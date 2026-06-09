import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AuthUser, KeycloakClaims, claimsToUser } from './auth-user';

export interface KeycloakVerifierOptions {
  /** Base Keycloak URL, e.g. http://localhost:8080 */
  authServerUrl: string;
  /** Realm name, e.g. "lingua" */
  realm: string;
  /**
   * Expected audience(s). Keycloak access tokens carry the client id(s) in
   * `aud` / `azp`. Optional — if omitted, audience is not checked (handy for
   * Slice-1 local dev where the BFF accepts the shell's public-client token).
   */
  audience?: string | string[];
}

/**
 * Validates Keycloak access tokens against the realm's JWKS endpoint.
 *
 * Framework-agnostic on purpose: the NestJS guard wraps this, but it can also
 * be used directly (e.g. in a WebSocket handshake in Slice 2). `jose`'s
 * `createRemoteJWKSet` caches keys and transparently refetches on rotation.
 */
export class KeycloakJwtVerifier {
  private readonly issuer: string;
  private readonly jwks: JWTVerifyGetKey;
  private readonly audience?: string | string[];

  constructor(opts: KeycloakVerifierOptions) {
    const base = opts.authServerUrl.replace(/\/+$/, '');
    this.issuer = `${base}/realms/${opts.realm}`;
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/protocol/openid-connect/certs`),
    );
    this.audience = opts.audience;
  }

  /** Verify a raw bearer token and return the authenticated user, or throw. */
  async verify(token: string): Promise<AuthUser> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.issuer,
      ...(this.audience ? { audience: this.audience } : {}),
    });
    return claimsToUser(payload as KeycloakClaims);
  }
}
