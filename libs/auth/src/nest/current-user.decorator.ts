import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from '../auth-user';
import { REQUEST_USER_KEY } from './auth.constants';

/**
 * Injects the authenticated {@link AuthUser} (set by {@link JwtAuthGuard}).
 * Pass a key to pull a single field, e.g. `@CurrentUser('sub') sub: string`.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request & Record<string, unknown>>();
    const user = req[REQUEST_USER_KEY] as AuthUser | undefined;
    if (!user) return undefined;
    return field ? user[field] : user;
  },
);
