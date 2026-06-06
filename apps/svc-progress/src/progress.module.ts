import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PROGRESS_STORE } from './domain/ports/progress.store';
import { CLOCK } from './domain/ports/clock';
import { ApplyReviewCompletedUseCase } from './application/apply-review-completed.usecase';
import { ApplySpeakingMistakeUseCase } from './application/apply-speaking-mistake.usecase';
import { GetProgressUseCase } from './application/get-progress.usecase';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { PrismaProgressStore } from './infrastructure/prisma/progress.prisma-store';
import { SystemClock } from './infrastructure/clock/system-clock';
import { ReviewCompletedConsumer } from './infrastructure/kafka/review-completed.consumer';
import { SpeakingMistakeConsumer } from './infrastructure/kafka/speaking-mistake.consumer';
import { ProgressController } from './interface/http/progress.controller';
import { ProgressGrpcController } from './interface/grpc/progress.grpc-controller';
import { HealthController } from './interface/http/health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [ProgressController, ProgressGrpcController, HealthController],
  providers: [
    ApplyReviewCompletedUseCase,
    ApplySpeakingMistakeUseCase,
    GetProgressUseCase,
    PrismaService,
    { provide: PROGRESS_STORE, useClass: PrismaProgressStore },
    { provide: CLOCK, useClass: SystemClock },
    ReviewCompletedConsumer,
    SpeakingMistakeConsumer,
  ],
})
export class ProgressModule {}
