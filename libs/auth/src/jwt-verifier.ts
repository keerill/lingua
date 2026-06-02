import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AuthUser, KeycloakClaims, claimsToUser } from './auth-user';

export interface KeycloakVerifierOptions {
  authServerUrl: string;

  realm: string;

  audience?: string | string[];
}

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

  async verify(token: string): Promise<AuthUser> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.issuer,
      ...(this.audience ? { audience: this.audience } : {}),
    });
    return claimsToUser(payload as KeycloakClaims);
  }
}
