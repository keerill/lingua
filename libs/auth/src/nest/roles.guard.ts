import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthUser } from '../auth-user';
import { LinguaRole } from './roles.decorator';
import { REQUEST_USER_KEY, ROLES_KEY } from './auth.constants';

/**
 * Enforces realm roles declared via {@link Roles}. Must run after
 * {@link JwtAuthGuard} (which populates `request.user`). Routes without a
 * `@Roles()` decorator are allowed through.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<LinguaRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request & Record<string, unknown>>();
    const user = req[REQUEST_USER_KEY] as AuthUser | undefined;
    const has = user?.roles?.some((r) => required.includes(r as LinguaRole));
    if (!has) {
      throw new ForbiddenException(`Requires role: ${required.join(' | ')}`);
    }
    return true;
  }
}
