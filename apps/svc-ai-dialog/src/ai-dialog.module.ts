import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule, OutboxRelayService, OUTBOX_STORE } from '@lingua/kafka';
import { GrpcClientModule } from '@lingua/grpc';
import { contentV1 } from '@lingua/contracts/proto';

import { LLM_PROVIDER, LlmProvider } from './domain/ports/llm.provider';
import { MISTAKE_DETECTOR } from './domain/ports/mistake.detector';
import { DIALOG_SESSION_REPOSITORY } from './domain/ports/dialog-session.repository';
import { SCENARIO_PROVIDER } from './domain/ports/scenario.provider';
import { RunTurnUseCase } from './application/run-turn.usecase';
import { ListScenariosUseCase } from './application/list-scenarios.usecase';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { PrismaDialogSessionRepository } from './infrastructure/prisma/dialog-session.prisma-repository';
import { PrismaOutboxStore } from './infrastructure/kafka/prisma-outbox.store';
import { ScenarioUpdatedConsumer } from './infrastructure/kafka/scenario-updated.consumer';
import {
  ContentScenarioGrpcClient,
  CONTENT_GRPC,
} from './infrastructure/content/content-scenario.grpc-client';
import { FakeLlmAdapter } from './infrastructure/llm/fake-llm.adapter';
import { HeuristicDetector } from './infrastructure/detect/heuristic-detector';
import { DialogController } from './interface/http/dialog.controller';
import { HealthController } from './interface/http/health.controller';

function llmFactory(): LlmProvider {
  if ((process.env.LLM_PROVIDER ?? 'fake').toLowerCase() === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
      throw new Error(
        'ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic',
      );
    const {
      AnthropicLlmAdapter,
    } = require('./infrastructure/llm/anthropic-llm.adapter');
    return new AnthropicLlmAdapter(
      apiKey,
      process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8',
    );
  }
  return new FakeLlmAdapter();
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    KafkaModule.forRoot({
      brokers: process.env.KAFKA_BROKERS ?? 'localhost:9092',
      clientId: 'svc-ai-dialog',
    }),
    GrpcClientModule.forService({
      name: CONTENT_GRPC,
      package: contentV1.LINGUA_CONTENT_V1_PACKAGE_NAME,
      protoPath: 'lingua/content/v1/content.proto',
      urlEnv: 'SVC_CONTENT_GRPC_URL',
      defaultUrl: 'localhost:50056',
    }),
  ],
  controllers: [DialogController, HealthController],
  providers: [
    RunTurnUseCase,
    ListScenariosUseCase,
    PrismaService,
    {
      provide: DIALOG_SESSION_REPOSITORY,
      useClass: PrismaDialogSessionRepository,
    },
    { provide: LLM_PROVIDER, useFactory: llmFactory },
    { provide: MISTAKE_DETECTOR, useClass: HeuristicDetector },
    ContentScenarioGrpcClient,
    { provide: SCENARIO_PROVIDER, useExisting: ContentScenarioGrpcClient },
    ScenarioUpdatedConsumer,
    PrismaOutboxStore,
    { provide: OUTBOX_STORE, useExisting: PrismaOutboxStore },
    OutboxRelayService,
  ],
})
export class AiDialogModule {}
