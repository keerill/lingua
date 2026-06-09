import { Inject, Injectable } from '@nestjs/common';
import { UserProfile } from '@lingua/contracts';
import { USER_REPOSITORY, UserRepository } from '../domain/ports/user.repository';
import { toUserProfile } from './sync-profile.usecase';

/** Use case: fetch a user profile by id, or null. */
@Injectable()
export class GetProfileUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(id: string): Promise<UserProfile | null> {
    const user = await this.users.findById(id);
    return user ? toUserProfile(user) : null;
  }
}
