import type { INestApplication } from '@nestjs/common';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { resolveProtoPath, resolveProtoRoot } from './proto-paths';

export interface GrpcServerOptions {
  package: string;

  protoPath: string;

  url: string;
}

const LOADER = {
  keepCase: false,
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true,
};

export function connectGrpcMicroservice(
  app: INestApplication,
  opts: GrpcServerOptions,
): void {
  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.GRPC,
      options: {
        package: opts.package,
        protoPath: resolveProtoPath(opts.protoPath),
        url: opts.url,
        loader: { ...LOADER, includeDirs: [resolveProtoRoot()] },
      },
    },
    { inheritAppConfig: true },
  );
}

export { LOADER as GRPC_LOADER_OPTIONS };
