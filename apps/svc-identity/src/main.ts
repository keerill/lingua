import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IdentityModule } from './identity.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(IdentityModule);
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.SVC_IDENTITY_PORT ?? 3101);
  await app.listen(port);
  Logger.log(`svc-identity listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
