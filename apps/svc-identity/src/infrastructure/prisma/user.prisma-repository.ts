import { Injectable } from '@nestjs/common';
import { ProfileData, User } from '../../domain/user.entity';
import { UserRepository } from '../../domain/ports/user.repository';
import { PrismaService } from './prisma.service';

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  createdAt: Date;
};

/** Prisma adapter for {@link UserRepository}. */
@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(data: ProfileData): Promise<User> {
    const row = await this.prisma.user.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        email: data.email,
        displayName: data.displayName,
        roles: data.roles,
      },
      update: {
        email: data.email,
        displayName: data.displayName,
        roles: data.roles,
      },
    });
    return this.toDomain(row);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(r: UserRow): User {
    return new User(r.id, r.email, r.displayName, r.roles, r.createdAt);
  }
}
