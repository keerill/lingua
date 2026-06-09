import { DynamicModule, Module, Provider } from '@nestjs/common';
import { KeycloakJwtVerifier, KeycloakVerifierOptions } from '../jwt-verifier';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { KEYCLOAK_VERIFIER } from './auth.constants';

@Module({})
export class AuthModule {
  /**
   * Configure Keycloak token validation for a NestJS service.
   *
   * @example
   * AuthModule.forRoot({
   *   authServerUrl: process.env.KEYCLOAK_URL!,
   *   realm: 'lingua',
   * })
   */
  static forRoot(options: KeycloakVerifierOptions): DynamicModule {
    const verifierProvider: Provider = {
      provide: KEYCLOAK_VERIFIER,
      useValue: new KeycloakJwtVerifier(options),
    };
    return {
      module: AuthModule,
      global: true,
      providers: [verifierProvider, JwtAuthGuard, RolesGuard],
      exports: [verifierProvider, JwtAuthGuard, RolesGuard],
    };
  }
}
