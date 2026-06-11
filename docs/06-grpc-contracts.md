# 06 — gRPC and Protobuf contracts

This document explains how Lingua's services make **direct, synchronous** calls to one
another — "give me the answer now" — using **gRPC**, and how the request/response shapes
are defined once in **Protobuf** and shared everywhere. It is the synchronous counterpart
to [05-messaging-kafka](./05-messaging-kafka.md), which covers the asynchronous, fire-and-
forget side.

## What is it

### RPC, from first principles

A **remote procedure call (RPC)** is the idea of calling a function that happens to run on
another machine *as if* it were a local function: you pass arguments, you wait, you get a
return value. The network round-trip is hidden behind an ordinary-looking method call.

REST is one way to do this, but it is loosely specified — you hand-write URLs, pick HTTP
verbs, and serialize JSON by convention. **gRPC** is a stricter, faster RPC framework:

- You declare the available methods and their request/response types **up front**, in a
  schema file.
- gRPC generates the client and server code from that schema, so the caller and callee can
  never disagree about the shape of a message — the compiler enforces it.
- Messages travel as compact **binary** (Protobuf) over HTTP/2, which is smaller and
  faster than JSON-over-HTTP/1.1.

### Protobuf, from first principles

**Protocol Buffers (Protobuf)** is the schema language gRPC uses. A `.proto` file
describes *services* (the callable methods) and *messages* (the data structures), with each
field given a name, a type, and a stable **field number**. For example, from
[`libs/contracts/proto/lingua/learning/v1/learning.proto`](../libs/contracts/proto/lingua/learning/v1/learning.proto):

```proto
service LearningService {
  rpc GetQueue(GetQueueRequest) returns (GetQueueResponse);
  rpc SubmitReview(SubmitReviewRequest) returns (NextSchedule);
}

message SubmitReviewRequest {
  string owner_id = 1;
  string card_id  = 2;
  int32  grade    = 3; // 1..4
}
```

The field *numbers* (`= 1`, `= 2`, …) are what actually travels on the wire — not the
names. That is what makes Protobuf both compact and forward/backward compatible: you can
rename a field freely, and you can add new fields without breaking old readers, as long as
you never reuse or repurpose a number.

### Why internal gRPC but edge REST/WebSocket?

A browser **cannot speak raw gRPC** — it has no direct access to the HTTP/2 framing gRPC
needs. So Lingua draws a hard line:

- **Inside** the cluster, service-to-service synchronous calls use **gRPC** (fast, typed,
  schema-checked).
- At the **edge**, the browser talks to the gateway-bff over **REST and WebSocket**. The
  BFF then re-issues the call to the right service over gRPC.

Today gRPC is used for: **gateway-bff → svc-learning / svc-vocabulary / svc-identity /
svc-progress**, and **svc-ai-dialog → svc-content**. Streaming dialog, multipart speech
uploads, Studio CRUD, and SSR all stay on REST/WebSocket because they don't fit a simple
request/response or can't be reached over gRPC.

## How Lingua uses it

### `libs/contracts` is the single source of truth

All cross-service contracts live in [`libs/contracts`](../libs/contracts). There are two
flavours, and they are kept deliberately in sync:

- **Plain TypeScript types** in [`src/events.ts`](../libs/contracts/src/events.ts) and the
  DTOs — used by the all-TypeScript backend directly, no generation needed.
- **Protobuf IDL** under [`proto/`](../libs/contracts/proto) — the language-neutral
  definition of both the gRPC services *and* the Kafka event schemas. There is one
  `.proto` per domain (`identity`, `vocabulary`, `learning`, `content`, `progress`) plus
  [`events/v1/events.proto`](../libs/contracts/proto/lingua/events/v1/events.proto), which
  mirrors `events.ts` so events can optionally travel as Protobuf (see
  [05-messaging-kafka](./05-messaging-kafka.md)).

The `.proto` files are the canonical contract. TypeScript stubs are *generated from them*,
never the other way around.

### The Buf toolchain and code generation

Lingua uses **[Buf](https://buf.build)** to lint, check, and compile the `.proto` files.
The config lives next to the protos:

- [`proto/buf.yaml`](../libs/contracts/proto/buf.yaml) — lint and breaking-change rules
  (the `STANDARD` lint set, with a couple of pragmatic exceptions so RPCs may return a
  domain message directly instead of a `<Method>Response` wrapper; breaking checks use the
  `FILE` rule set).
- [`proto/buf.gen.yaml`](../libs/contracts/proto/buf.gen.yaml) — the codegen plan, with two
  targets:
  - **ts-proto** (`nestJs=true`) → NestJS-flavoured gRPC service/client stubs, written to
    `libs/contracts/src/generated/ts`.
  - **protoc-gen-es** → Protobuf message classes for the Kafka events (consumed by the
    Schema Registry serde), written to `libs/contracts/src/generated/es`.

The generated code is **committed to the repo** and is imported through the
`@lingua/contracts/proto` subpath (mapped in `tsconfig.base.json` to
`libs/contracts/src/generated/index.ts`). **Do not hand-edit anything under
`src/generated/`** — it is overwritten on every regeneration. The Docker build compiles
the committed `.ts` and never runs Buf or `protoc`.

### `descriptor.binpb` — the language-neutral proof

Running codegen also produces
[`libs/contracts/gen/descriptor.binpb`](../libs/contracts/gen/descriptor.binpb), a compiled
`FileDescriptorSet` covering every `.proto`. This is the canonical, *language-neutral*
artifact any toolchain's codegen can consume — concrete evidence that the contracts are not
tied to TypeScript. A non-TS consumer would generate its own stubs straight from this file
(see [`libs/contracts/gen/README.md`](../libs/contracts/gen/README.md) for the exact
command). TypeScript just happens to be the only runtime today.

### Turning a service into a hybrid app (HTTP + gRPC)

A callee service keeps its HTTP server *and* adds a gRPC endpoint — a **hybrid app**. The
mechanics are tiny because they're wrapped in [`libs/grpc`](../libs/grpc). In a service's
`main.ts`, after creating the Nest app you call `connectGrpcMicroservice` and start the
microservice alongside the HTTP listener
([`apps/svc-learning/src/main.ts`](../apps/svc-learning/src/main.ts)):

```ts
const grpcPort = Number(process.env.SVC_LEARNING_GRPC_PORT ?? 50053);
connectGrpcMicroservice(app, {
  package: learningV1.LINGUA_LEARNING_V1_PACKAGE_NAME,
  protoPath: 'lingua/learning/v1/learning.proto',
  url: `0.0.0.0:${grpcPort}`,
});
await app.startAllMicroservices();
await app.listen(port); // HTTP still listens too
```

`connectGrpcMicroservice` ([`libs/grpc/src/grpc-server.ts`](../libs/grpc/src/grpc-server.ts))
wires the NestJS `Transport.GRPC` microservice and resolves the `.proto` path at runtime via
[`proto-paths.ts`](../libs/grpc/src/proto-paths.ts) (it searches `PROTO_DIR`,
`libs/contracts/proto`, and a couple of fallbacks).

The actual method implementations are **thin gRPC controllers** that reuse the same
use-cases the HTTP controllers already use. From
[`apps/svc-learning/src/interface/grpc/learning.grpc-controller.ts`](../apps/svc-learning/src/interface/grpc/learning.grpc-controller.ts):

```ts
@Controller()
@learningV1.LearningServiceControllerMethods()
export class LearningGrpcController implements learningV1.LearningServiceController {
  constructor(
    private readonly getReviewQueue: GetReviewQueueUseCase,
    private readonly submitReviewUseCase: SubmitReviewUseCase,
  ) {}

  async getQueue(request: learningV1.GetQueueRequest) { /* delegate to use-case */ }
  async submitReview(request: learningV1.SubmitReviewRequest) { /* delegate */ }
}
```

The `LearningServiceController` interface and the `@LearningServiceControllerMethods()`
decorator are *generated* from the `.proto` — the compiler guarantees the controller
implements every declared RPC. The gRPC controller is just a different *interface* layer
over the same hexagonal core (see [03-backend-nestjs](./03-backend-nestjs.md)). The
`owner_id` field replaces what used to be an `x-owner-id` HTTP header.

### A client adapter that swaps HTTP → gRPC in one line

The caller side is the elegant part. The gateway-bff defines a **port** (an interface its
use-cases depend on) such as `LearningPort`. A gRPC **client adapter** implements that port
([`apps/gateway-bff/src/infrastructure/clients/learning.grpc-client.ts`](../apps/gateway-bff/src/infrastructure/clients/learning.grpc-client.ts)):

```ts
@Injectable()
export class LearningGrpcClient implements LearningPort, OnModuleInit {
  private svc!: learningV1.LearningServiceClient;
  constructor(@Inject(LEARNING_GRPC) private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.svc = this.client.getService(learningV1.LEARNING_SERVICE_NAME);
  }

  async getQueue(userId: string, limit: number) {
    const res = await firstValueFrom(this.svc.getQueue({ ownerId: userId, limit }));
    return res.rows ?? [];
  }
}
```

Because both the old `*.http-client.ts` and the new `*.grpc-client.ts` implement the **same
port**, switching transports is a **one-line dependency-injection change** in the module.
In [`apps/gateway-bff/src/gateway.module.ts`](../apps/gateway-bff/src/gateway.module.ts):

```ts
{ provide: LEARNING_PORT, useClass: LearningGrpcClient },  // was LearningHttpClient
```

The client connection itself is registered with `GrpcClientModule.forService`
([`libs/grpc/src/grpc-client.module.ts`](../libs/grpc/src/grpc-client.module.ts)), which
reads the target URL from an env var with a sensible default:

```ts
GrpcClientModule.forService({
  name: LEARNING_GRPC,
  package: learningV1.LINGUA_LEARNING_V1_PACKAGE_NAME,
  protoPath: 'lingua/learning/v1/learning.proto',
  urlEnv: 'SVC_LEARNING_GRPC_URL',
  defaultUrl: 'localhost:50053',
});
```

The internal gRPC endpoints sit in the **50051–50057** range — e.g. identity `50051`,
vocabulary `50052`, learning `50053`, content `50056`, progress `50057`. The old HTTP
clients are kept in the tree as a one-line rollback path. (Distributed traces follow gRPC
calls automatically; see [13-observability](./13-observability.md).)

## Key files

- [`libs/contracts/proto/`](../libs/contracts/proto) — the `.proto` source of truth (one
  per domain plus `events/v1/events.proto`), with `buf.yaml` and `buf.gen.yaml`.
- [`libs/contracts/src/generated/`](../libs/contracts/src/generated) — committed,
  generated stubs (`ts/` for gRPC via ts-proto, `es/` for event messages via
  protoc-gen-es). **Do not edit by hand.** Imported as `@lingua/contracts/proto`.
- [`libs/contracts/gen/descriptor.binpb`](../libs/contracts/gen/descriptor.binpb) and
  [`libs/contracts/gen/README.md`](../libs/contracts/gen/README.md) — the language-neutral
  `FileDescriptorSet` and how a non-TS consumer would use it.
- [`libs/grpc/src/grpc-server.ts`](../libs/grpc/src/grpc-server.ts) —
  `connectGrpcMicroservice` (server side of a hybrid app).
- [`libs/grpc/src/grpc-client.module.ts`](../libs/grpc/src/grpc-client.module.ts) —
  `GrpcClientModule.forService` (client registration).
- [`libs/grpc/src/proto-paths.ts`](../libs/grpc/src/proto-paths.ts) — runtime resolution of
  the `.proto` directory.
- [`apps/svc-learning/src/interface/grpc/learning.grpc-controller.ts`](../apps/svc-learning/src/interface/grpc/learning.grpc-controller.ts),
  [`apps/svc-learning/src/main.ts`](../apps/svc-learning/src/main.ts) — a callee's gRPC
  controller and its hybrid bootstrap.
- [`apps/gateway-bff/src/infrastructure/clients/learning.grpc-client.ts`](../apps/gateway-bff/src/infrastructure/clients/learning.grpc-client.ts),
  [`apps/gateway-bff/src/gateway.module.ts`](../apps/gateway-bff/src/gateway.module.ts) — a
  caller's client adapter and the one-line DI swap.
- [`package.json`](../package.json) — the `proto:gen`, `buf:lint`, and `buf:breaking`
  scripts.

## See it in action

Regenerate the stubs and the descriptor after editing any `.proto`:

```bash
pnpm proto:gen
```

This runs `buf generate` against `libs/contracts/proto` (writing the `ts/` and `es/` stubs)
and `buf build … -o libs/contracts/gen/descriptor.binpb` (refreshing the descriptor). The
generated files are committed, so `pnpm proto:gen` is what you run *after* changing a
contract.

Lint the protos against the Buf style rules:

```bash
pnpm buf:lint
```

Check that your changes do not **break** existing consumers — Buf compares the current
protos against `main` and fails on any incompatible change (a removed field, a changed
type, a reused field number):

```bash
pnpm buf:breaking
```

`buf:breaking` is also run in CI on every change to keep contracts backward-compatible (see
[14-ci-cd](./14-ci-cd.md)). To exercise the gRPC path end to end, bring up the dev infra and
the services, then drive the app through the gateway-bff — every review queue fetch and
review submission flows over the learning gRPC endpoint described above.

## Related

- [01-architecture](./01-architecture.md) — where synchronous gRPC fits among the services.
- [03-backend-nestjs](./03-backend-nestjs.md) — ports/adapters and why a gRPC controller is
  just another interface layer.
- [05-messaging-kafka](./05-messaging-kafka.md) — the asynchronous side and the Protobuf
  event schemas / Schema Registry.
- [13-observability](./13-observability.md) — automatic tracing across gRPC calls.
- [14-ci-cd](./14-ci-cd.md) — `buf lint` / `buf breaking` as a CI gate.
