import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { UserProfile } from '@lingua/contracts';
import { SyncProfileInput, SyncProfileUseCase } from '../../application/sync-profile.usecase';
import { GetProfileUseCase } from '../../application/get-profile.usecase';

/**
 * Internal API (called by the gateway-bff). The BFF has already validated the
 * Keycloak token and passes the claims it extracted.
 */
@Controller('internal/users')
export class IdentityController {
  constructor(
    private readonly syncProfile: SyncProfileUseCase,
    private readonly getProfile: GetProfileUseCase,
  ) {}

  @Post('sync')
  sync(@Body() body: SyncProfileInput): Promise<UserProfile> {
    return this.syncProfile.execute(body);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<UserProfile> {
    const profile = await this.getProfile.execute(id);
    if (!profile) throw new NotFoundException(`User ${id} not found`);
    return profile;
  }
}
