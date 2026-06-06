import '@lingua/observability/register';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createOtelLogger } from '@lingua/observability';
import { connectGrpcMicroservice } from '@lingua/grpc';
import { contentV1 } from '@lingua/contracts/proto';
import { ContentModule } from './content.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ContentModule);
  app.useLogger(createOtelLogger());
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const grpcPort = Number(process.env.SVC_CONTENT_GRPC_PORT ?? 50056);
  connectGrpcMicroservice(app, {
    package: contentV1.LINGUA_CONTENT_V1_PACKAGE_NAME,
    protoPath: 'lingua/content/v1/content.proto',
    url: `0.0.0.0:${grpcPort}`,
  });
  await app.startAllMicroservices();

  const port = Number(process.env.SVC_CONTENT_PORT ?? 3106);
  await app.listen(port);
  Logger.log(
    `svc-content listening on http://localhost:${port} (gRPC :${grpcPort})`,
    'Bootstrap',
  );
}

void bootstrap();
