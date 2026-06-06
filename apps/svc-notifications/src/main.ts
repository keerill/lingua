import '@lingua/observability/register';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createOtelLogger } from '@lingua/observability';
import { NotificationsModule } from './notifications.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(NotificationsModule);
  app.useLogger(createOtelLogger());
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.SVC_NOTIFICATIONS_PORT ?? 3108);
  await app.listen(port);
  Logger.log(`svc-notifications listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
