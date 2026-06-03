import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule, OutboxRelayService, OUTBOX_STORE } from '@lingua/kafka';

import { FsrsService } from './domain/fsrs.domain-service';
import { SCHEDULE_REPOSITORY } from './domain/ports/schedule.repository';
import { REVIEW_OUTCOME_WRITER } from './domain/ports/review-outcome.writer';
import { CreateInitialScheduleUseCase } from './application/create-initial-schedule.usecase';
import { GetReviewQueueUseCase } from './application/get-review-queue.usecase';
import { SubmitReviewUseCase } from './application/submit-review.usecase';
import { FlagCardsDueUseCase } from './application/flag-cards-due.usecase';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { PrismaScheduleRepository } from './infrastructure/prisma/schedule.prisma-repository';
import { PrismaReviewOutcomeWriter } from './infrastructure/prisma/review-outcome.prisma-writer';
import { PrismaOutboxStore } from './infrastructure/kafka/prisma-outbox.store';
import { CardCreatedConsumer } from './infrastructure/kafka/card-created.consumer';
import { ReviewCompletedLoggerConsumer } from './infrastructure/kafka/review-completed-logger.consumer';
import { CardsFlaggedConsumer } from './infrastructure/kafka/cards-flagged.consumer';
import { LearningController } from './interface/http/learning.controller';
import { LearningGrpcController } from './interface/grpc/learning.grpc-controller';
import { HealthController } from './interface/http/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    KafkaModule.forRoot({
      brokers: process.env.KAFKA_BROKERS ?? 'localhost:9092',
      clientId: 'svc-learning',
    }),
  ],
  controllers: [LearningController, LearningGrpcController, HealthController],
  providers: [
    FsrsService,
    CreateInitialScheduleUseCase,
    GetReviewQueueUseCase,
    SubmitReviewUseCase,
    FlagCardsDueUseCase,
    PrismaService,
    { provide: SCHEDULE_REPOSITORY, useClass: PrismaScheduleRepository },
    { provide: REVIEW_OUTCOME_WRITER, useClass: PrismaReviewOutcomeWriter },
    PrismaOutboxStore,
    { provide: OUTBOX_STORE, useExisting: PrismaOutboxStore },
    OutboxRelayService,
    CardCreatedConsumer,
    ReviewCompletedLoggerConsumer,
    CardsFlaggedConsumer,
  ],
})
export class LearningModule {}
