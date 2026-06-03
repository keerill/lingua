import { ProfileData, User } from '../user.entity';

export const USER_REPOSITORY = Symbol('UserRepository');

export interface UserRepository {
  upsert(data: ProfileData): Promise<User>;
}
