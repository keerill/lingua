import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import axios from 'axios';

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
}

/**
 * Keycloak OIDC client for the BFF. The browser (public client, shell) starts
 * a PKCE flow; the BFF (confidential client) performs the code→token exchange
 * and refresh server-side, so the refresh token never reaches the SPA.
 *
 * We do NOT mint our own JWT — Keycloak is the issuer.
 */
@Injectable()
export class KeycloakOidcService {
  private readonly logger = new Logger(KeycloakOidcService.name);
  private readonly base = (process.env.KEYCLOAK_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
  private readonly realm = process.env.KEYCLOAK_REALM ?? 'lingua';
  private readonly clientId = process.env.KEYCLOAK_BFF_CLIENT_ID ?? 'lingua-bff';
  private readonly clientSecret = process.env.KEYCLOAK_BFF_CLIENT_SECRET ?? '';

  private get tokenEndpoint(): string {
    return `${this.base}/realms/${this.realm}/protocol/openid-connect/token`;
  }
  private get authEndpoint(): string {
    return `${this.base}/realms/${this.realm}/protocol/openid-connect/auth`;
  }
  private get logoutEndpoint(): string {
    return `${this.base}/realms/${this.realm}/protocol/openid-connect/logout`;
  }

  /** Generate a PKCE verifier and its S256 challenge. */
  createPkce(): { verifier: string; challenge: string } {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  }

  /** Random opaque state value for CSRF protection on the OIDC redirect. */
  createState(): string {
    return randomBytes(16).toString('base64url');
  }

  /** Build the Keycloak authorization-redirect URL (PKCE S256). */
  buildAuthUrl(redirectUri: string, state: string, challenge: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'openid profile email',
      redirect_uri: redirectUri,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return `${this.authEndpoint}?${params.toString()}`;
  }

  /** Exchange an authorization code for tokens (confidential client + PKCE verifier). */
  async exchangeCode(code: string, redirectUri: string, verifier: string): Promise<TokenSet> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });
    const { data } = await axios.post<TokenSet>(this.tokenEndpoint, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data;
  }

  /** Rotate tokens using a refresh token. */
  async refresh(refreshToken: string): Promise<TokenSet> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });
    const { data } = await axios.post<TokenSet>(this.tokenEndpoint, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data;
  }

  /** Revoke the session at Keycloak (logout). */
  async logout(refreshToken: string): Promise<void> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });
    try {
      await axios.post(this.logoutEndpoint, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch (err) {
      this.logger.warn(`logout revoke failed: ${(err as Error).message}`);
    }
  }
}
