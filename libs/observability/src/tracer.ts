import { Span, SpanStatusCode, trace } from '@opentelemetry/api';

const TRACER_NAME = '@lingua/observability';

export function getTracer() {
  return trace.getTracer(TRACER_NAME);
}

export async function startActiveRootSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  return getTracer().startActiveSpan(
    name,
    { root: true, attributes },
    async (span) => {
      try {
        return await fn(span);
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
      }
    },
  );
}
