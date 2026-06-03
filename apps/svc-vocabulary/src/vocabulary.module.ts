import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule, OutboxRelayService, OUTBOX_STORE } from '@lingua/kafka';

import { DECK_REPOSITORY } from './domain/ports/deck.repository';
import { CARD_REPOSITORY } from './domain/ports/card.repository';
import { CreateDeckUseCase } from './application/create-deck.usecase';
import { ListDecksUseCase } from './application/list-decks.usecase';
import { CreateCardUseCase } from './application/create-card.usecase';
import { GetCardsByIdsUseCase } from './application/get-cards-by-ids.usecase';
import { IngestSpeakingMistakesUseCase } from './application/ingest-speaking-mistakes.usecase';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { PrismaDeckRepository } from './infrastructure/prisma/deck.prisma-repository';
import { PrismaCardRepository } from './infrastructure/prisma/card.prisma-repository';
import { PrismaOutboxStore } from './infrastructure/kafka/prisma-outbox.store';
import { SpeakingMistakeConsumer } from './infrastructure/kafka/speaking-mistake.consumer';
import { VocabularyController } from './interface/http/vocabulary.controller';
import { VocabularyGrpcController } from './interface/grpc/vocabulary.grpc-controller';
import { HealthController } from './interface/http/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    KafkaModule.forRoot({
      brokers: process.env.KAFKA_BROKERS ?? 'localhost:9092',
      clientId: 'svc-vocabulary',
    }),
  ],
  controllers: [
    VocabularyController,
    VocabularyGrpcController,
    HealthController,
  ],
  providers: [
    CreateDeckUseCase,
    ListDecksUseCase,
    CreateCardUseCase,
    GetCardsByIdsUseCase,
    IngestSpeakingMistakesUseCase,
    PrismaService,
    { provide: DECK_REPOSITORY, useClass: PrismaDeckRepository },
    { provide: CARD_REPOSITORY, useClass: PrismaCardRepository },
    PrismaOutboxStore,
    { provide: OUTBOX_STORE, useExisting: PrismaOutboxStore },
    OutboxRelayService,
    SpeakingMistakeConsumer,
  ],
})
export class VocabularyModule {}
