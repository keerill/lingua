import '@lingua/observability/register';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createOtelLogger } from '@lingua/observability';
import { AiDialogModule } from './ai-dialog.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AiDialogModule);
  app.useLogger(createOtelLogger());
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.SVC_AI_DIALOG_PORT ?? 3104);
  await app.listen(port);
  Logger.log(`svc-ai-dialog listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
