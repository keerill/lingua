import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@lingua/auth';

// Application
import { VOCABULARY_PORT } from './application/ports/vocabulary.port';
import { LEARNING_PORT } from './application/ports/learning.port';
import { IDENTITY_PORT } from './application/ports/identity.port';
import { GetReviewQueueUseCase } from './application/get-review-queue.usecase';
// Infrastructure (port adapters)
import { VocabularyHttpClient } from './infrastructure/clients/vocabulary.http-client';
import { LearningHttpClient } from './infrastructure/clients/learning.http-client';
import { IdentityHttpClient } from './infrastructure/clients/identity.http-client';
import { KeycloakOidcService } from './infrastructure/auth/keycloak-oidc.service';
// Interface (primary adapters)
import { AuthController } from './interface/http/auth.controller';
import { DecksController } from './interface/http/decks.controller';
import { ReviewsController } from './interface/http/reviews.controller';
import { MeController } from './interface/http/me.controller';
import { HealthController } from './interface/http/health.controller';

/**
 * BFF composition root: binds the downstream client ports to their HTTP
 * adapters and wires the aggregation use case. The BFF is an orchestrator —
 * it has no domain of its own.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Keycloak token validation (JWKS). Audience left open in Slice 1 dev.
    AuthModule.forRoot({
      authServerUrl: process.env.KEYCLOAK_URL ?? 'http://localhost:8080',
      realm: process.env.KEYCLOAK_REALM ?? 'lingua',
    }),
  ],
  controllers: [
    AuthController,
    DecksController,
    ReviewsController,
    MeController,
    HealthController,
  ],
  providers: [
    KeycloakOidcService,
    GetReviewQueueUseCase,
    { provide: VOCABULARY_PORT, useClass: VocabularyHttpClient },
    { provide: LEARNING_PORT, useClass: LearningHttpClient },
    { provide: IDENTITY_PORT, useClass: IdentityHttpClient },
  ],
})
export class GatewayModule {}
