# 13 — Observability

A distributed system is a maze: one user click fans out across several services and a Kafka
bus. When something is slow or broken, "which line of which service?" is the wrong question —
you need to follow *the whole request* across process and network boundaries. Observability is
how you do that. Lingua wires up **OpenTelemetry** so that a single user action — say, one
conversation turn — shows up in Grafana as **one end-to-end trace that spans every service and
even the Kafka boundary**.

The whole thing is **opt-in and zero-cost when off**: it activates only when an OTLP endpoint
is configured, so plain `nx serve` during development is completely untouched.

## What is it

### The three pillars: logs, metrics, traces

- **Logs** are timestamped text records of discrete events ("outbox relay started", "speaking
  turn failed"). Great for *what happened*, weak for *how things relate*.
- **Metrics** are aggregated numbers over time — request rate, error rate, p95 latency,
  Kafka consumer lag. Cheap to store, ideal for dashboards and alerts, but they tell you
  *that* latency rose, not *why*.
- **Traces** follow one request across services. A **trace** is a tree of **spans**; each span
  is one unit of work (an HTTP handler, a DB query, a Kafka publish) with a start/end time,
  attributes, and a parent. A trace is the thing that answers "where did the time go for *this*
  request?"

The three correlate: a trace has a `trace_id`; if every log line carries that same `trace_id`,
you can jump from a slow span straight to the logs it produced.

### Distributed tracing — and why it's hard

Within one process, propagating the "current span" is easy. The problem is **boundaries**:

- **HTTP/gRPC call** — the caller must put trace IDs into request headers and the callee must
  read them back out, or the trace breaks into two unrelated halves.
- **Async messaging (Kafka)** — even harder. The producer writes a message and *returns*; the
  consumer processes it *later*, in a different process, with no live call stack linking them.

The industry answer is **context propagation** via the **W3C Trace Context** standard: a
`traceparent` string (trace id + parent span id + flags) is *injected* into headers by the
sender and *extracted* by the receiver, which makes its new span a child of the sender's span.
Lingua does this for HTTP/gRPC automatically and for Kafka explicitly (see below).

### OpenTelemetry, OTLP, and the Collector

- **OpenTelemetry (OTel)** is the vendor-neutral standard + SDKs for producing all three
  signals. You instrument once; you stay free to switch backends.
- **OTLP** (OpenTelemetry Protocol) is the wire format. Services export traces/metrics/logs
  over OTLP (HTTP or gRPC) to a collector.
- **OpenTelemetry Collector** is a standalone process that receives OTLP and *fans out* each
  signal to the right backend. Centralizing this means services don't need to know about
  Tempo/Prometheus/Loki — they just speak OTLP to one address.

### The backends

| Backend | Signal | Role |
|---|---|---|
| **Tempo** | traces | stores trace waterfalls; queried with TraceQL |
| **Prometheus** | metrics | time-series DB; here it scrapes RED metrics derived from spans + Kafka lag |
| **Loki** | logs | log store, indexed by labels; ingests logs natively over OTLP |
| **Grafana** | all | the UI; dashboards over Tempo/Prometheus/Loki with cross-links |

A neat detail: Lingua doesn't run a separate metrics agent for request latency. The Collector's
**spanmetrics connector** *derives* RED metrics (Rate, Errors, Duration) from the trace spans
already flowing through it, and Prometheus scrapes those. One instrumentation, two signals.

## How Lingua uses it

Everything lives in one library, **`@lingua/observability`**
([libs/observability/src](../libs/observability/src)), and is consumed by every backend service.

### 1. The `register` side-effect (first import in `main.ts`)

OpenTelemetry's auto-instrumentation must be installed **before** any library it patches (HTTP,
Express, `pg`, etc.) is loaded. So each service's entrypoint imports the side-effect module
*first, on line 1*:

```ts
// apps/svc-ai-dialog/src/main.ts
import '@lingua/observability/register';
import { Logger, ValidationPipe } from '@nestjs/common';
// ...
```

[`register.ts`](../libs/observability/src/register.ts) is the opt-in gate:

```ts
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const sdk = buildSdk();
  sdk.start();
  // graceful shutdown on SIGTERM/SIGINT
}
```

If `OTEL_EXPORTER_OTLP_ENDPOINT` is **unset**, this is a complete **no-op** — nothing starts,
no overhead, no behaviour change. That's why dev `nx serve` is unaffected: you only pay for
observability when you point it at a Collector.

### 2. The SDK and auto-instrumentation

[`sdk.ts`](../libs/observability/src/sdk.ts) builds a `NodeSDK` with all three OTLP exporters
(trace/metric/log) and `getNodeAutoInstrumentations()`. Auto-instrumentation transparently
patches **HTTP, Express, NestJS, `pg` (Postgres), Redis, and gRPC**, so inbound requests,
outbound calls, DB queries, and gRPC round-trips become spans without any per-handler code.
(`fs` instrumentation is disabled to cut noise.) The service name is taken from
`OTEL_SERVICE_NAME` or the package name.

### 3. Logs that carry the trace id

[`logger.ts`](../libs/observability/src/logger.ts) provides `OtelLoggerService`, a NestJS
`LoggerService` that emits through the OTel Logs API. Because it runs inside the active span's
context, each log record is automatically correlated with the current `trace_id` — so in
Grafana you can pivot from a span to its logs in Loki. Each service installs it in `main.ts`:

```ts
app.useLogger(createOtelLogger());
```

### 4. The Kafka trace-propagation bridge (the important part)

This is where Lingua keeps one trace intact across the async Kafka boundary. The mechanism has
three steps and hinges on Lingua's **transactional outbox** (see [05 — Messaging /
Kafka](./05-messaging-kafka.md)).

**(a) Capture at write time.** When a service writes an event into its `outbox` table, it
captures the *current* trace context into a new `headers` column using `traceHeaders()`
([propagation.ts](../libs/observability/src/propagation.ts)), which injects `traceparent` into a
carrier. Example from `svc-ai-dialog`'s repository:

```ts
await tx.outbox.create({
  data: {
    topic: input.event.type,
    key: input.event.payload.userId,
    payload: input.event as object,
    headers: traceHeaders(),   // <-- W3C context frozen at insert time
  },
});
```

The capture happens **inside the same DB transaction** as the business write, so the trace
context is durably tied to the event even though the event won't be published until later.

**(b) Producer span in the relay.** The outbox relay
([libs/kafka/src/outbox.ts](../libs/kafka/src/outbox.ts)) doesn't just send the row; it wraps
each send in `publishWithSpan(...)`. That helper *extracts* the saved headers as the parent
context, opens a **PRODUCER** span (`<topic> send`), re-injects the now-updated context into the
Kafka message headers, and sends. So the Kafka message physically carries the trace forward.

**(c) Consumer span on the other side.** A consumer wraps its handler in
`consumeWithSpan(...)`, which extracts the trace context from the message headers and opens a
**CONSUMER** span (`<topic> process`) as a child of the producer span. The trace does **not**
break across the async hop — producer and consumer are linked.

Both helpers live in [propagation.ts](../libs/observability/src/propagation.ts) and are covered
by [propagation.spec.ts](../libs/observability/src/propagation.spec.ts).

### 5. The WebSocket turn root span

A WebSocket frame isn't an HTTP request, so auto-instrumentation has nothing to anchor a trace
to. The gateway therefore opens its own root span. In
[`realtime.gateway.ts`](../apps/gateway-bff/src/interface/ws/realtime.gateway.ts) a speaking
turn is wrapped in `startActiveRootSpan('speaking.turn', ...)`
([tracer.ts](../libs/observability/src/tracer.ts)), tagged with the scenario, session, and user.
Every HTTP/gRPC call the turn makes (to `svc-speech`, `svc-ai-dialog`) auto-attaches beneath it,
and any Kafka event it triggers continues the same trace — so one spoken sentence is a single
waterfall from WebSocket → speech/dialog → Kafka → vocabulary → Kafka → learning.

### Where it runs

The stack runs in **both** environments from one set of config files. For development there's a
compose profile, [`docker-compose.observability.yml`](../infra/docker/docker-compose.observability.yml),
layered on top of the dev infra; the same config/dashboard files are bind-mounted from the Helm
charts so dev and k8s stay identical. For Kubernetes the components are Helm subcharts gated by
`global.observability.enabled` (see [12 — Kubernetes / Helm](./12-kubernetes-helm.md)).

### Dashboards

Three provisioned Grafana dashboards live in
[infra/helm/lingua/charts/grafana/files/dashboards](../infra/helm/lingua/charts/grafana/files/dashboards):

- **`service-latency.json`** — RED metrics from the spanmetrics connector: request rate, error
  rate, and p50/p95 latency per service.
- **`kafka-lag.json`** — consumer-group lag and message-in rate per topic (from a
  `kafka-exporter` scraped by Prometheus).
- **`e2e-traces.json`** — TraceQL tables of end-to-end traces: card-review traces
  (`learning.review.completed send`) and conversation-turn traces (`speaking.turn`). Click a
  trace ID to open the waterfall and watch one trace cross multiple services and Kafka.

## Key files

- [`libs/observability/src/register.ts`](../libs/observability/src/register.ts) — opt-in gate; first import in every `main.ts`.
- [`libs/observability/src/sdk.ts`](../libs/observability/src/sdk.ts) — `NodeSDK`, OTLP exporters, auto-instrumentation.
- [`libs/observability/src/propagation.ts`](../libs/observability/src/propagation.ts) — `traceHeaders`, `publishWithSpan`, `consumeWithSpan` (the Kafka bridge).
- [`libs/observability/src/tracer.ts`](../libs/observability/src/tracer.ts) — `startActiveRootSpan` for the WebSocket turn.
- [`libs/observability/src/logger.ts`](../libs/observability/src/logger.ts) — `OtelLoggerService`, trace-correlated logs.
- [`libs/kafka/src/outbox.ts`](../libs/kafka/src/outbox.ts) — relay wraps each send in `publishWithSpan`.
- [`apps/svc-ai-dialog/src/main.ts`](../apps/svc-ai-dialog/src/main.ts) — shows the first-import pattern and `useLogger(createOtelLogger())`.
- [`apps/svc-ai-dialog/src/infrastructure/prisma/dialog-session.prisma-repository.ts`](../apps/svc-ai-dialog/src/infrastructure/prisma/dialog-session.prisma-repository.ts) — `headers: traceHeaders()` capture at outbox-insert time.
- [`infra/docker/docker-compose.observability.yml`](../infra/docker/docker-compose.observability.yml) — dev stack (Collector, Tempo, Prometheus, Loki, Grafana, kafka-exporter).
- [`infra/helm/lingua/charts/grafana/files/dashboards`](../infra/helm/lingua/charts/grafana/files/dashboards) — the three dashboards.

## See it in action

1. **Start infra + the observability stack** (the second file layers on top):

   ```bash
   docker compose -f infra/docker/docker-compose.dev.yml \
                  -f infra/docker/docker-compose.observability.yml up -d
   ```

2. **Point the services at the Collector.** Set the OTLP endpoint so instrumentation switches
   on (in `.env` or per-process):

   ```bash
   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
   OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
   ```

   Then run a couple of services, e.g.:

   ```bash
   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 pnpm nx serve gateway-bff
   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 pnpm nx serve svc-ai-dialog
   ```

3. **Generate traffic** — do a speaking turn in the UI, or fire a dialog turn:

   ```bash
   curl -N -X POST http://localhost:3104/dialog/turn \
     -H 'content-type: application/json' \
     -d '{"sessionId":"s1","userId":"u1","scenario":"cafe",
          "userText":"Yesterday I go to the airport and I miss my fly."}'
   ```

4. **Open Grafana** at <http://localhost:3001> (anonymous viewer is enabled; admin login is
   `admin`/`admin`). Open the **End-to-End Traces** dashboard, click a trace ID, and watch the
   waterfall cross `gateway-bff` → `svc-ai-dialog` → the `speaking.mistake.detected send`
   producer span → Kafka → `svc-vocabulary` → `svc-learning`, all in one trace. Check
   **Service Latency** for RED metrics and **Kafka Consumer Lag** for per-topic lag.

5. **Confirm the no-op default.** Run any service *without* `OTEL_EXPORTER_OTLP_ENDPOINT`
   (a plain `pnpm nx serve svc-ai-dialog`) — no SDK starts, nothing is exported, behaviour is
   identical to a non-observed build.

## Related

- [05 — Messaging / Kafka](./05-messaging-kafka.md) — the outbox the Kafka trace bridge rides on.
- [01 — Architecture](./01-architecture.md) — the service topology a trace travels through.
- [10 — AI & Speech](./10-ai-speech.md) — the speaking turn that becomes one root-span trace.
- [11 — Docker](./11-docker.md) and [12 — Kubernetes / Helm](./12-kubernetes-helm.md) — where the stack is deployed in each environment.
