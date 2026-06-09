import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { GatewayModule } from './gateway.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(GatewayModule);
  app.enableShutdownHooks();
  app.use(cookieParser(process.env.BFF_COOKIE_SECRET));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Allow the shell SPA to call the BFF with credentials (cookies).
  app.enableCors({
    origin: process.env.SHELL_PUBLIC_URL ?? 'http://localhost:4200',
    credentials: true,
  });

  const port = Number(process.env.GATEWAY_BFF_PORT ?? 3000);
  await app.listen(port);
  Logger.log(`gateway-bff listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
