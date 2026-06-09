import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Trusted owner id from the internal `x-owner-id` header, set by the BFF after
 * it validated the Keycloak token.
 */
export const OwnerId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request>();
  const header = req.headers['x-owner-id'];
  const ownerId = Array.isArray(header) ? header[0] : header;
  if (!ownerId) {
    throw new BadRequestException('Missing x-owner-id header');
  }
  return ownerId;
});
