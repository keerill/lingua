import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

export const OwnerId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers['x-owner-id'];
    const ownerId = Array.isArray(header) ? header[0] : header;
    if (!ownerId) {
      throw new BadRequestException('Missing x-owner-id header');
    }
    return ownerId;
  },
);
