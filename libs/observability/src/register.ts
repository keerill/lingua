import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { buildSdk } from './sdk';

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  if (process.env.OTEL_LOG_LEVEL) {
    diag.setLogger(
      new DiagConsoleLogger(),
      DiagLogLevel[
        process.env.OTEL_LOG_LEVEL.toUpperCase() as keyof typeof DiagLogLevel
      ] ?? DiagLogLevel.INFO,
    );
  }

  const sdk = buildSdk();
  sdk.start();

  const shutdown = (): void => {
    sdk
      .shutdown()
      .catch((err) => console.error('[otel] shutdown failed', err))
      .finally(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
