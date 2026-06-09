import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { VocabularyModule } from './vocabulary.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(VocabularyModule);
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.SVC_VOCABULARY_PORT ?? 3102);
  await app.listen(port);
  Logger.log(`svc-vocabulary listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
