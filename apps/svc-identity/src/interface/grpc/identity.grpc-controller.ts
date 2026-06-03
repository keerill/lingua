import { Controller } from '@nestjs/common';
import { identityV1 } from '@lingua/contracts/proto';
import { SyncProfileUseCase } from '../../application/sync-profile.usecase';

@Controller()
@identityV1.IdentityServiceControllerMethods()
export class IdentityGrpcController
  implements identityV1.IdentityServiceController
{
  constructor(private readonly syncProfile: SyncProfileUseCase) {}

  sync(request: identityV1.SyncRequest): Promise<identityV1.UserProfile> {
    return this.syncProfile.execute({
      id: request.id,
      email: request.email,
      displayName: request.displayName,
      roles: request.roles ?? [],
    });
  }
}
