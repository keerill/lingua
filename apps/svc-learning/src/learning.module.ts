import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from '@lingua/kafka';

// Domain
import { FsrsService } from './domain/fsrs.domain-service';
import { SCHEDULE_REPOSITORY } from './domain/ports/schedule.repository';
import { REVIEW_OUTCOME_WRITER } from './domain/ports/review-outcome.writer';
// Application (use cases)
import { CreateInitialScheduleUseCase } from './application/create-initial-schedule.usecase';
import { GetReviewQueueUseCase } from './application/get-review-queue.usecase';
import { SubmitReviewUseCase } from './application/submit-review.usecase';
// Infrastructure (adapters)
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { PrismaScheduleRepository } from './infrastructure/prisma/schedule.prisma-repository';
import { PrismaReviewOutcomeWriter } from './infrastructure/prisma/review-outcome.prisma-writer';
import { PrismaOutboxStore } from './infrastructure/kafka/prisma-outbox.store';
import { OutboxRelayService } from './infrastructure/kafka/outbox-relay.service';
import { CardCreatedConsumer } from './infrastructure/kafka/card-created.consumer';
import { ReviewCompletedLoggerConsumer } from './infrastructure/kafka/review-completed-logger.consumer';
// Interface (primary adapters)
import { LearningController } from './interface/http/learning.controller';
import { HealthController } from './interface/http/health.controller';

/**
 * Composition root (Hexagonal): binds outbound port tokens to their Prisma
 * adapters, wires use cases, and registers the primary adapters (HTTP
 * controller + Kafka consumers + outbox relay).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    KafkaModule.forRoot({
      brokers: process.env.KAFKA_BROKERS ?? 'localhost:9092',
      clientId: 'svc-learning',
    }),
  ],
  controllers: [LearningController, HealthController],
  providers: [
    // domain services
    FsrsService,
    // use cases
    CreateInitialScheduleUseCase,
    GetReviewQueueUseCase,
    SubmitReviewUseCase,
    // port → adapter bindings
    PrismaService,
    { provide: SCHEDULE_REPOSITORY, useClass: PrismaScheduleRepository },
    { provide: REVIEW_OUTCOME_WRITER, useClass: PrismaReviewOutcomeWriter },
    // kafka infrastructure
    PrismaOutboxStore,
    OutboxRelayService,
    CardCreatedConsumer,
    ReviewCompletedLoggerConsumer,
  ],
})
export class LearningModule {}
