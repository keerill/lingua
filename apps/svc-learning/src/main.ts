import '@lingua/observability/register';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createOtelLogger } from '@lingua/observability';
import { connectGrpcMicroservice } from '@lingua/grpc';
import { learningV1 } from '@lingua/contracts/proto';
import { LearningModule } from './learning.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(LearningModule);
  app.useLogger(createOtelLogger());
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const grpcPort = Number(process.env.SVC_LEARNING_GRPC_PORT ?? 50053);
  connectGrpcMicroservice(app, {
    package: learningV1.LINGUA_LEARNING_V1_PACKAGE_NAME,
    protoPath: 'lingua/learning/v1/learning.proto',
    url: `0.0.0.0:${grpcPort}`,
  });
  await app.startAllMicroservices();

  const port = Number(process.env.SVC_LEARNING_PORT ?? 3103);
  await app.listen(port);
  Logger.log(
    `svc-learning listening on http://localhost:${port} (gRPC :${grpcPort})`,
    'Bootstrap',
  );
}

void bootstrap();
