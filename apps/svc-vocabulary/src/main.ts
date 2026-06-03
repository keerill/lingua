import '@lingua/observability/register';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createOtelLogger } from '@lingua/observability';
import { connectGrpcMicroservice } from '@lingua/grpc';
import { vocabularyV1 } from '@lingua/contracts/proto';
import { VocabularyModule } from './vocabulary.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(VocabularyModule);
  app.useLogger(createOtelLogger());
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const grpcPort = Number(process.env.SVC_VOCABULARY_GRPC_PORT ?? 50052);
  connectGrpcMicroservice(app, {
    package: vocabularyV1.LINGUA_VOCABULARY_V1_PACKAGE_NAME,
    protoPath: 'lingua/vocabulary/v1/vocabulary.proto',
    url: `0.0.0.0:${grpcPort}`,
  });
  await app.startAllMicroservices();

  const port = Number(process.env.SVC_VOCABULARY_PORT ?? 3102);
  await app.listen(port);
  Logger.log(
    `svc-vocabulary listening on http://localhost:${port} (gRPC :${grpcPort})`,
    'Bootstrap',
  );
}

void bootstrap();
