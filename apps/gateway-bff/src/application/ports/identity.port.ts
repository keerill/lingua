import { UserProfile } from '@lingua/contracts';

/** DI token for the {@link IdentityPort} (downstream svc-identity). */
export const IDENTITY_PORT = Symbol('IdentityPort');

export interface SyncProfileInput {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}

/** Outbound port: the BFF's view of svc-identity. */
export interface IdentityPort {
  sync(input: SyncProfileInput): Promise<UserProfile>;
}
