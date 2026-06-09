import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from './auth.constants';

/** Lingua realm roles. */
export type LinguaRole = 'learner' | 'admin';

/** Restrict a route/controller to the given realm roles (any-of). */
export const Roles = (...roles: LinguaRole[]) => SetMetadata(ROLES_KEY, roles);
