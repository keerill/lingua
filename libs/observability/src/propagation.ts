import {
  context,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';

const TRACER_NAME = '@lingua/observability';

export function traceHeaders(): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier;
}

function asCarrier(
  headers: Record<string, string> | null | undefined,
): Record<string, string> | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  return headers;
}

export async function publishWithSpan(
  opts: {
    topic: string;
    key: string;
    parentHeaders?: Record<string, string> | null;
  },
  send: (headers: Record<string, string>) => Promise<void>,
): Promise<void> {
  const carrier = asCarrier(opts.parentHeaders);
  const parentCtx = carrier
    ? propagation.extract(ROOT_CONTEXT, carrier)
    : context.active();

  const span = trace.getTracer(TRACER_NAME).startSpan(
    `${opts.topic} send`,
    {
      kind: SpanKind.PRODUCER,
      attributes: {
        'messaging.system': 'kafka',
        'messaging.operation': 'publish',
        'messaging.destination.name': opts.topic,
        'messaging.kafka.message.key': opts.key,
      },
    },
    parentCtx,
  );

  const spanCtx = trace.setSpan(parentCtx, span);
  try {
    const headers: Record<string, string> = {};
    propagation.inject(spanCtx, headers);
    await send(headers);
  } catch (err) {
    span.recordException(err as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw err;
  } finally {
    span.end();
  }
}

export async function consumeWithSpan(
  opts: { topic: string; headers?: Record<string, string> | null },
  handle: () => Promise<void>,
): Promise<void> {
  const carrier = asCarrier(opts.headers);
  const parentCtx = carrier
    ? propagation.extract(ROOT_CONTEXT, carrier)
    : ROOT_CONTEXT;

  const span = trace.getTracer(TRACER_NAME).startSpan(
    `${opts.topic} process`,
    {
      kind: SpanKind.CONSUMER,
      attributes: {
        'messaging.system': 'kafka',
        'messaging.operation': 'process',
        'messaging.destination.name': opts.topic,
      },
    },
    parentCtx,
  );

  try {
    await context.with(trace.setSpan(parentCtx, span), handle);
  } catch (err) {
    span.recordException(err as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw err;
  } finally {
    span.end();
  }
}
