import {
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { KEYCLOAK_VERIFIER, KeycloakJwtVerifier } from '@lingua/auth';
import { KeycloakOidcService } from '../../infrastructure/auth/keycloak-oidc.service';
import { IDENTITY_PORT, IdentityPort } from '../../application/ports/identity.port';

const REFRESH_COOKIE = 'lingua_rt';
const PKCE_COOKIE = 'lingua_pkce';
const STATE_COOKIE = 'lingua_state';

/**
 * BFF auth endpoints implementing the Keycloak PKCE flow. The browser is a
 * public client; the BFF is confidential and holds the refresh token in an
 * httpOnly cookie with rotation. The SPA only ever sees short-lived access
 * tokens (returned via the callback redirect fragment).
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly oidc: KeycloakOidcService,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    @Inject(KEYCLOAK_VERIFIER) private readonly verifier: KeycloakJwtVerifier,
  ) {}

  private get callbackUri(): string {
    const base = process.env.BFF_PUBLIC_URL ?? 'http://localhost:3000';
    return `${base}/auth/callback`;
  }

  private cookieOpts(maxAgeMs: number) {
    return {
      httpOnly: true,
      secure: false, // Slice 1 dev over http; true behind TLS
      sameSite: 'lax' as const,
      path: '/',
      maxAge: maxAgeMs,
    };
  }

  /** Start login: set PKCE + state cookies, redirect to Keycloak. */
  @Get('login')
  login(@Res() res: Response): void {
    const { verifier, challenge } = this.oidc.createPkce();
    const state = this.oidc.createState();
    res.cookie(PKCE_COOKIE, verifier, this.cookieOpts(10 * 60_000));
    res.cookie(STATE_COOKIE, state, this.cookieOpts(10 * 60_000));
    res.redirect(this.oidc.buildAuthUrl(this.callbackUri, state, challenge));
  }

  /** OIDC redirect target: exchange code, set refresh cookie, hand access to SPA. */
  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const code = String(req.query['code'] ?? '');
    const state = String(req.query['state'] ?? '');
    const verifier = req.cookies?.[PKCE_COOKIE];
    const expectedState = req.cookies?.[STATE_COOKIE];

    if (!code || !state || !verifier || state !== expectedState) {
      throw new UnauthorizedException('Invalid OIDC callback');
    }

    const tokens = await this.oidc.exchangeCode(code, this.callbackUri, verifier);

    // Upsert the profile from the validated token claims (first-login sync).
    const user = await this.verifier.verify(tokens.access_token);
    await this.identity.sync({
      id: user.sub,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
    });

    res.clearCookie(PKCE_COOKIE, { path: '/' });
    res.clearCookie(STATE_COOKIE, { path: '/' });
    res.cookie(
      REFRESH_COOKIE,
      tokens.refresh_token,
      this.cookieOpts(tokens.refresh_expires_in * 1000),
    );

    // Return the access token to the SPA via the URL fragment (not logged by servers).
    const shell = process.env.SHELL_PUBLIC_URL ?? 'http://localhost:4200';
    res.redirect(`${shell}/auth/callback#access_token=${tokens.access_token}`);
  }

  /** Rotate tokens using the httpOnly refresh cookie. */
  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response): Promise<void> {
    const rt = req.cookies?.[REFRESH_COOKIE];
    if (!rt) throw new UnauthorizedException('No refresh cookie');

    const tokens = await this.oidc.refresh(rt);
    res.cookie(
      REFRESH_COOKIE,
      tokens.refresh_token,
      this.cookieOpts(tokens.refresh_expires_in * 1000),
    );
    res.json({ access_token: tokens.access_token, expires_in: tokens.expires_in });
  }

  /** Revoke the Keycloak session and clear the cookie. */
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const rt = req.cookies?.[REFRESH_COOKIE];
    if (rt) await this.oidc.logout(rt);
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    res.json({ ok: true });
  }
}
