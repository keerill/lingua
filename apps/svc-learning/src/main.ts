import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { LearningModule } from './learning.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(LearningModule);
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.SVC_LEARNING_PORT ?? 3103);
  await app.listen(port);
  Logger.log(`svc-learning listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
