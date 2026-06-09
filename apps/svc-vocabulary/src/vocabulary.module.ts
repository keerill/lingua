import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from '@lingua/kafka';

// Domain ports
import { DECK_REPOSITORY } from './domain/ports/deck.repository';
import { CARD_REPOSITORY } from './domain/ports/card.repository';
// Application (use cases)
import { CreateDeckUseCase } from './application/create-deck.usecase';
import { ListDecksUseCase } from './application/list-decks.usecase';
import { CreateCardUseCase } from './application/create-card.usecase';
import { GetCardsByIdsUseCase } from './application/get-cards-by-ids.usecase';
// Infrastructure (adapters)
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { PrismaDeckRepository } from './infrastructure/prisma/deck.prisma-repository';
import { PrismaCardRepository } from './infrastructure/prisma/card.prisma-repository';
import { PrismaOutboxStore } from './infrastructure/kafka/prisma-outbox.store';
import { OutboxRelayService } from './infrastructure/kafka/outbox-relay.service';
// Interface (primary adapters)
import { VocabularyController } from './interface/http/vocabulary.controller';
import { HealthController } from './interface/http/health.controller';

/** Composition root (Hexagonal): binds ports to Prisma adapters, wires use cases. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    KafkaModule.forRoot({
      brokers: process.env.KAFKA_BROKERS ?? 'localhost:9092',
      clientId: 'svc-vocabulary',
    }),
  ],
  controllers: [VocabularyController, HealthController],
  providers: [
    CreateDeckUseCase,
    ListDecksUseCase,
    CreateCardUseCase,
    GetCardsByIdsUseCase,
    PrismaService,
    { provide: DECK_REPOSITORY, useClass: PrismaDeckRepository },
    { provide: CARD_REPOSITORY, useClass: PrismaCardRepository },
    PrismaOutboxStore,
    OutboxRelayService,
  ],
})
export class VocabularyModule {}
