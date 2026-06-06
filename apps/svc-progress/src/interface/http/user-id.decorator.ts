import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers['x-user-id'];
    const userId = Array.isArray(header) ? header[0] : header;
    if (!userId) {
      throw new BadRequestException('Missing x-user-id header');
    }
    return userId;
  },
);
