import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { KeycloakJwtVerifier } from '../jwt-verifier';
import { KEYCLOAK_VERIFIER, REQUEST_USER_KEY } from './auth.constants';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(KEYCLOAK_VERIFIER) private readonly verifier: KeycloakJwtVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearer(req);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const user = await this.verifier.verify(token);
      (req as Request & Record<string, unknown>)[REQUEST_USER_KEY] = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractBearer(req: Request): string | null {
    const header = req.headers['authorization'];
    if (!header || Array.isArray(header)) return null;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : null;
  }
}
