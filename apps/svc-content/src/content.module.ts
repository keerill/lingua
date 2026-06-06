import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule, OutboxRelayService, OUTBOX_STORE } from '@lingua/kafka';

import { SCENARIO_REPOSITORY } from './domain/ports/scenario.repository';
import { LESSON_REPOSITORY } from './domain/ports/lesson.repository';
import { DECK_TEMPLATE_REPOSITORY } from './domain/ports/deck-template.repository';
import {
  CreateScenarioUseCase,
  DeleteScenarioUseCase,
  GetScenarioUseCase,
  ListScenariosUseCase,
  UpdateScenarioUseCase,
} from './application/scenario.usecases';
import {
  CreateLessonUseCase,
  DeleteLessonUseCase,
  GetLessonUseCase,
  ListLessonsUseCase,
  UpdateLessonUseCase,
} from './application/lesson.usecases';
import {
  CreateDeckTemplateUseCase,
  DeleteDeckTemplateUseCase,
  ListDeckTemplatesUseCase,
  UpdateDeckTemplateUseCase,
} from './application/deck-template.usecases';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { PrismaScenarioRepository } from './infrastructure/prisma/scenario.prisma-repository';
import { PrismaLessonRepository } from './infrastructure/prisma/lesson.prisma-repository';
import { PrismaDeckTemplateRepository } from './infrastructure/prisma/deck-template.prisma-repository';
import { PrismaOutboxStore } from './infrastructure/kafka/prisma-outbox.store';
import { ScenariosController } from './interface/http/scenarios.controller';
import { LessonsController } from './interface/http/lessons.controller';
import { DeckTemplatesController } from './interface/http/deck-templates.controller';
import { PublicContentController } from './interface/http/public-content.controller';
import { ContentGrpcController } from './interface/grpc/content.grpc-controller';
import { HealthController } from './interface/http/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    KafkaModule.forRoot({
      brokers: process.env.KAFKA_BROKERS ?? 'localhost:9092',
      clientId: 'svc-content',
    }),
  ],
  controllers: [
    ScenariosController,
    LessonsController,
    DeckTemplatesController,
    PublicContentController,
    ContentGrpcController,
    HealthController,
  ],
  providers: [
    CreateScenarioUseCase,
    UpdateScenarioUseCase,
    DeleteScenarioUseCase,
    ListScenariosUseCase,
    GetScenarioUseCase,
    CreateLessonUseCase,
    UpdateLessonUseCase,
    DeleteLessonUseCase,
    ListLessonsUseCase,
    GetLessonUseCase,
    CreateDeckTemplateUseCase,
    UpdateDeckTemplateUseCase,
    DeleteDeckTemplateUseCase,
    ListDeckTemplatesUseCase,
    PrismaService,
    { provide: SCENARIO_REPOSITORY, useClass: PrismaScenarioRepository },
    { provide: LESSON_REPOSITORY, useClass: PrismaLessonRepository },
    {
      provide: DECK_TEMPLATE_REPOSITORY,
      useClass: PrismaDeckTemplateRepository,
    },
    PrismaOutboxStore,
    { provide: OUTBOX_STORE, useExisting: PrismaOutboxStore },
    OutboxRelayService,
  ],
})
export class ContentModule {}
