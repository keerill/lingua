import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { consumeWithSpan, publishWithSpan, traceHeaders } from './propagation';

describe('propagation bridge', () => {
  const exporter = new InMemorySpanExporter();
  const contextManager = new AsyncLocalStorageContextManager();
  let provider: BasicTracerProvider;

  beforeAll(() => {
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
    context.setGlobalContextManager(contextManager.enable());
    provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    trace.setGlobalTracerProvider(provider);
  });

  afterEach(() => exporter.reset());
  afterAll(async () => {
    contextManager.disable();
    await provider.shutdown();
  });

  it('traceHeaders injects the active span as W3C traceparent', async () => {
    const tracer = trace.getTracer('test');
    const span = tracer.startSpan('write');
    const carrier = await context.with(
      trace.setSpan(context.active(), span),
      async () => traceHeaders(),
    );
    span.end();

    expect(carrier.traceparent).toBeDefined();
    expect(carrier.traceparent).toContain(span.spanContext().traceId);
  });

  it('keeps one trace across publish → headers → consume', async () => {
    const tracer = trace.getTracer('test');
    const writeSpan = tracer.startSpan('outbox-write');
    const parentHeaders = await context.with(
      trace.setSpan(context.active(), writeSpan),
      async () => traceHeaders(),
    );
    writeSpan.end();
    const traceId = writeSpan.spanContext().traceId;

    let kafkaHeaders: Record<string, string> = {};
    await publishWithSpan(
      { topic: 'learning.review.completed', key: 'card-1', parentHeaders },
      async (headers) => {
        kafkaHeaders = headers;
      },
    );
    expect(kafkaHeaders.traceparent).toContain(traceId);

    let observedTraceId: string | undefined;
    await consumeWithSpan(
      { topic: 'learning.review.completed', headers: kafkaHeaders },
      async () => {
        observedTraceId = trace.getActiveSpan()?.spanContext().traceId;
      },
    );
    expect(observedTraceId).toBe(traceId);

    const kinds = exporter.getFinishedSpans().map((s) => s.name);
    expect(kinds).toContain('learning.review.completed send');
    expect(kinds).toContain('learning.review.completed process');
  });
});
