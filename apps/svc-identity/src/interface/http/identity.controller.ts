import { Body, Controller, Post } from '@nestjs/common';
import { UserProfile } from '@lingua/contracts';
import {
  SyncProfileInput,
  SyncProfileUseCase,
} from '../../application/sync-profile.usecase';

@Controller('internal/users')
export class IdentityController {
  constructor(private readonly syncProfile: SyncProfileUseCase) {}

  @Post('sync')
  sync(@Body() body: SyncProfileInput): Promise<UserProfile> {
    return this.syncProfile.execute(body);
  }
}
