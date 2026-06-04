import { UserProfile } from '@lingua/contracts';

export const IDENTITY_PORT = Symbol('IdentityPort');

export interface SyncProfileInput {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}

export interface IdentityPort {
  sync(input: SyncProfileInput): Promise<UserProfile>;
}
