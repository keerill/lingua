import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { UserProfile } from '@lingua/contracts';
import { identityV1 } from '@lingua/contracts/proto';
import {
  IdentityPort,
  SyncProfileInput,
} from '../../application/ports/identity.port';
import { IDENTITY_GRPC } from './grpc.tokens';

@Injectable()
export class IdentityGrpcClient implements IdentityPort, OnModuleInit {
  private svc!: identityV1.IdentityServiceClient;

  constructor(@Inject(IDENTITY_GRPC) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.svc = this.client.getService<identityV1.IdentityServiceClient>(
      identityV1.IDENTITY_SERVICE_NAME,
    );
  }

  async sync(input: SyncProfileInput): Promise<UserProfile> {
    return firstValueFrom(
      this.svc.sync({
        id: input.id,
        email: input.email,
        displayName: input.displayName,
        roles: input.roles,
      }),
    );
  }
}
