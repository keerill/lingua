import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from './auth.constants';

export type LinguaRole = 'learner' | 'admin';

export const Roles = (...roles: LinguaRole[]) => SetMetadata(ROLES_KEY, roles);
