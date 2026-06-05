import '@lingua/observability/register';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createOtelLogger } from '@lingua/observability';
import { SpeechModule } from './speech.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(SpeechModule);
  app.useLogger(createOtelLogger());
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.SVC_SPEECH_PORT ?? 3105);
  await app.listen(port);
  Logger.log(`svc-speech listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
