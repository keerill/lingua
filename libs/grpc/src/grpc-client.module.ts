import type { DynamicModule } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { GRPC_LOADER_OPTIONS } from './grpc-server';
import { resolveProtoPath, resolveProtoRoot } from './proto-paths';

export interface GrpcClientOptions {
  name: string;

  package: string;

  protoPath: string;

  urlEnv: string;

  defaultUrl: string;
}

export const GrpcClientModule = {
  forService(opts: GrpcClientOptions): DynamicModule {
    const url = process.env[opts.urlEnv] ?? opts.defaultUrl;
    return ClientsModule.register([
      {
        name: opts.name,
        transport: Transport.GRPC,
        options: {
          package: opts.package,
          protoPath: resolveProtoPath(opts.protoPath),
          url,
          loader: { ...GRPC_LOADER_OPTIONS, includeDirs: [resolveProtoRoot()] },
        },
      },
    ]);
  },
};
