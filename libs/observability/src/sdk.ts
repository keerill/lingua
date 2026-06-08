import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';

function resolveServiceName(): string {
  const fromEnv = process.env.OTEL_SERVICE_NAME?.trim();
  if (fromEnv) return fromEnv;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require(`${process.cwd()}/package.json`) as { name?: string };
    if (pkg.name) return pkg.name.replace(/^@[^/]+\//, '');
  } catch {}
  return 'lingua-service';
}

export function buildSdk(): NodeSDK {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: resolveServiceName(),
    [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION ?? '0.4.0',
  });

  return new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
    }),
    logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
}
