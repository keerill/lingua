import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@lingua/auth';
import { GrpcClientModule } from '@lingua/grpc';
import {
  learningV1,
  vocabularyV1,
  identityV1,
  progressV1,
} from '@lingua/contracts/proto';

import { VOCABULARY_PORT } from './application/ports/vocabulary.port';
import { LEARNING_PORT } from './application/ports/learning.port';
import { IDENTITY_PORT } from './application/ports/identity.port';
import { SPEECH_PORT } from './application/ports/speech.port';
import { DIALOG_PORT } from './application/ports/dialog.port';
import { PROGRESS_PORT } from './application/ports/progress.port';
import { CONTENT_PORT } from './application/ports/content.port';
import { GetReviewQueueUseCase } from './application/get-review-queue.usecase';
import { RunSpeakingTurnUseCase } from './application/run-speaking-turn.usecase';
import { LearningGrpcClient } from './infrastructure/clients/learning.grpc-client';
import { VocabularyGrpcClient } from './infrastructure/clients/vocabulary.grpc-client';
import { IdentityGrpcClient } from './infrastructure/clients/identity.grpc-client';
import { ProgressGrpcClient } from './infrastructure/clients/progress.grpc-client';
import {
  IDENTITY_GRPC,
  LEARNING_GRPC,
  PROGRESS_GRPC,
  VOCABULARY_GRPC,
} from './infrastructure/clients/grpc.tokens';
import { SpeechHttpClient } from './infrastructure/clients/speech.http-client';
import { DialogHttpClient } from './infrastructure/clients/dialog.http-client';
import { ContentHttpClient } from './infrastructure/clients/content.http-client';
import { KeycloakOidcService } from './infrastructure/auth/keycloak-oidc.service';
import { AuthController } from './interface/http/auth.controller';
import { DecksController } from './interface/http/decks.controller';
import { ReviewsController } from './interface/http/reviews.controller';
import { MeController } from './interface/http/me.controller';
import { HealthController } from './interface/http/health.controller';
import { SpeakingController } from './interface/http/speaking.controller';
import { ProgressController } from './interface/http/progress.controller';
import { StudioController } from './interface/http/studio.controller';
import { RealtimeGateway } from './interface/ws/realtime.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule.forRoot({
      authServerUrl: process.env.KEYCLOAK_URL ?? 'http://localhost:8080',
      realm: process.env.KEYCLOAK_REALM ?? 'lingua',
    }),
    GrpcClientModule.forService({
      name: LEARNING_GRPC,
      package: learningV1.LINGUA_LEARNING_V1_PACKAGE_NAME,
      protoPath: 'lingua/learning/v1/learning.proto',
      urlEnv: 'SVC_LEARNING_GRPC_URL',
      defaultUrl: 'localhost:50053',
    }),
    GrpcClientModule.forService({
      name: VOCABULARY_GRPC,
      package: vocabularyV1.LINGUA_VOCABULARY_V1_PACKAGE_NAME,
      protoPath: 'lingua/vocabulary/v1/vocabulary.proto',
      urlEnv: 'SVC_VOCABULARY_GRPC_URL',
      defaultUrl: 'localhost:50052',
    }),
    GrpcClientModule.forService({
      name: IDENTITY_GRPC,
      package: identityV1.LINGUA_IDENTITY_V1_PACKAGE_NAME,
      protoPath: 'lingua/identity/v1/identity.proto',
      urlEnv: 'SVC_IDENTITY_GRPC_URL',
      defaultUrl: 'localhost:50051',
    }),
    GrpcClientModule.forService({
      name: PROGRESS_GRPC,
      package: progressV1.LINGUA_PROGRESS_V1_PACKAGE_NAME,
      protoPath: 'lingua/progress/v1/progress.proto',
      urlEnv: 'SVC_PROGRESS_GRPC_URL',
      defaultUrl: 'localhost:50057',
    }),
  ],
  controllers: [
    AuthController,
    DecksController,
    ReviewsController,
    MeController,
    HealthController,
    SpeakingController,
    ProgressController,
    StudioController,
  ],
  providers: [
    KeycloakOidcService,
    GetReviewQueueUseCase,
    RunSpeakingTurnUseCase,
    RealtimeGateway,
    { provide: VOCABULARY_PORT, useClass: VocabularyGrpcClient },
    { provide: LEARNING_PORT, useClass: LearningGrpcClient },
    { provide: IDENTITY_PORT, useClass: IdentityGrpcClient },
    { provide: SPEECH_PORT, useClass: SpeechHttpClient },
    { provide: DIALOG_PORT, useClass: DialogHttpClient },
    { provide: PROGRESS_PORT, useClass: ProgressGrpcClient },
    { provide: CONTENT_PORT, useClass: ContentHttpClient },
  ],
})
export class GatewayModule {}
