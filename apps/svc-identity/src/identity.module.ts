import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { USER_REPOSITORY } from './domain/ports/user.repository';
import { SyncProfileUseCase } from './application/sync-profile.usecase';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { PrismaUserRepository } from './infrastructure/prisma/user.prisma-repository';
import { IdentityController } from './interface/http/identity.controller';
import { IdentityGrpcController } from './interface/grpc/identity.grpc-controller';
import { HealthController } from './interface/http/health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [IdentityController, IdentityGrpcController, HealthController],
  providers: [
    SyncProfileUseCase,
    PrismaService,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
  ],
})
export class IdentityModule {}
