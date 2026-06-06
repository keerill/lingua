import '@lingua/observability/register';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createOtelLogger } from '@lingua/observability';
import { connectGrpcMicroservice } from '@lingua/grpc';
import { progressV1 } from '@lingua/contracts/proto';
import { ProgressModule } from './progress.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ProgressModule);
  app.useLogger(createOtelLogger());
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const grpcPort = Number(process.env.SVC_PROGRESS_GRPC_PORT ?? 50057);
  connectGrpcMicroservice(app, {
    package: progressV1.LINGUA_PROGRESS_V1_PACKAGE_NAME,
    protoPath: 'lingua/progress/v1/progress.proto',
    url: `0.0.0.0:${grpcPort}`,
  });
  await app.startAllMicroservices();

  const port = Number(process.env.SVC_PROGRESS_PORT ?? 3107);
  await app.listen(port);
  Logger.log(
    `svc-progress listening on http://localhost:${port} (gRPC :${grpcPort})`,
    'Bootstrap',
  );
}

void bootstrap();
