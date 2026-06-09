import { ProfileData, User } from '../user.entity';

/** DI token for the {@link UserRepository} outbound port. */
export const USER_REPOSITORY = Symbol('UserRepository');

/** Outbound port: persistence of user profiles. */
export interface UserRepository {
  /** Create-or-update by Keycloak `sub`; returns the stored profile. */
  upsert(data: ProfileData): Promise<User>;
  findById(id: string): Promise<User | null>;
}
