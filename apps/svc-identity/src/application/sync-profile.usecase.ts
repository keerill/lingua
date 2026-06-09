import { Inject, Injectable } from '@nestjs/common';
import { UserProfile } from '@lingua/contracts';
import { ProfileData, User } from '../domain/user.entity';
import { USER_REPOSITORY, UserRepository } from '../domain/ports/user.repository';

export type SyncProfileInput = ProfileData;

/** Map a domain User to the published contract DTO. */
export const toUserProfile = (u: User): UserProfile => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  roles: u.roles,
  createdAt: u.createdAt.toISOString(),
});

/**
 * Use case: upsert a user profile from validated Keycloak claims. Called by the
 * BFF on first request after login (idempotent on subsequent ones).
 */
@Injectable()
export class SyncProfileUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(input: SyncProfileInput): Promise<UserProfile> {
    const user = await this.users.upsert(input);
    return toUserProfile(user);
  }
}
