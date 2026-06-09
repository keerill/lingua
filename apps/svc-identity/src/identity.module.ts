import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { USER_REPOSITORY } from './domain/ports/user.repository';
import { SyncProfileUseCase } from './application/sync-profile.usecase';
import { GetProfileUseCase } from './application/get-profile.usecase';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { PrismaUserRepository } from './infrastructure/prisma/user.prisma-repository';
import { IdentityController } from './interface/http/identity.controller';
import { HealthController } from './interface/http/health.controller';

/** Composition root: binds the UserRepository port to its Prisma adapter. */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [IdentityController, HealthController],
  providers: [
    SyncProfileUseCase,
    GetProfileUseCase,
    PrismaService,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
  ],
})
export class IdentityModule {}
