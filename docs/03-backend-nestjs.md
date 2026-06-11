# 03 — Backend: NestJS + Hexagonal Architecture

Every backend service in Lingua is a [NestJS](https://nestjs.com/) application written in
TypeScript. They all follow the same internal shape: **Hexagonal architecture**
(also called *Ports & Adapters*) with a pinch of **tactical Domain-Driven Design (DDD)**.

This document explains those ideas from scratch and then walks through one real service —
[`apps/svc-learning`](../apps/svc-learning) — tracing a single HTTP request from the
controller all the way down to the database and back.

If "microservice", "dependency injection" or "port" are new words to you, read on in order;
each section builds on the previous one.

## What is it

### NestJS in five concepts

NestJS is a server framework for Node.js. It does not invent much new syntax; instead it
organizes your code around a handful of building blocks.

| Concept | Plain-English meaning | Decorator |
|---|---|---|
| **Module** | A box that groups related code and declares what it needs and what it offers. The application is a tree of modules. | `@Module({...})` |
| **Provider** | Any class Nest can construct and hand to others — a service, a use-case, a repository. | `@Injectable()` |
| **Controller** | A class whose methods are mapped to incoming requests (HTTP routes, gRPC methods, etc.). | `@Controller('path')` |
| **Dependency Injection (DI)** | You declare what you need in a constructor; Nest builds and supplies it. You never write `new`. | constructor params |
| **Decorator** | The `@Something` annotations. They attach *metadata* that Nest reads at startup to wire everything together. | `@Get()`, `@Body()`, `@Inject()` |

**Dependency injection** is the heart of it. Instead of a class reaching out and creating
its own collaborators, it lists them as constructor parameters and Nest passes them in:

```ts
@Injectable()
export class SubmitReviewUseCase {
  constructor(
    @Inject(SCHEDULE_REPOSITORY) private readonly schedules: ScheduleRepository,
    @Inject(REVIEW_OUTCOME_WRITER) private readonly writer: ReviewOutcomeWriter,
    private readonly fsrs: FsrsService,
  ) {}
}
```

The use-case does not know *which concrete* repository it got — only that it satisfies the
`ScheduleRepository` interface. That indirection is exactly what makes the next idea work.

### Hexagonal architecture (Ports & Adapters)

The goal is to keep your **business logic independent of the outside world** (HTTP, the
database, Kafka, third-party APIs). You draw a line around the core and only let the outside
talk to it through narrow contracts.

- A **port** is an interface the core defines — "I need something that can save a schedule".
- An **adapter** is a concrete implementation of a port — "here's one backed by Postgres",
  or "here's a fake one backed by a `Map`, for tests".

```
              outside world                core                 outside world
        ┌──────────────────────┐   ┌──────────────────┐   ┌──────────────────────┐
  HTTP →│ interface/ (adapter) │ → │ application/ +   │ → │ infrastructure/      │→ Postgres
  gRPC →│   controllers        │   │   domain/        │   │   (adapters impl.    │  Kafka
        └──────────────────────┘   │   (ports here)   │   │    the ports)        │
                                    └──────────────────┘   └──────────────────────┘
```

The core depends only on **its own port interfaces**, never on Express, Prisma or Kafka.

### Tactical DDD vocabulary used here

| Term | In this repo |
|---|---|
| **Entity** | A core object with identity and behaviour, e.g. [`Schedule`](../apps/svc-learning/src/domain/schedule.entity.ts). |
| **Domain service** | Pure logic that doesn't belong to one entity, e.g. [`FsrsService`](../apps/svc-learning/src/domain/fsrs.domain-service.ts) (spaced-repetition math). |
| **Use-case** (application service) | One business operation, orchestrating entities + ports, e.g. [`SubmitReviewUseCase`](../apps/svc-learning/src/application/submit-review.usecase.ts). |
| **Port** | An interface + an injection token (a `Symbol`), e.g. [`ScheduleRepository`](../apps/svc-learning/src/domain/ports/schedule.repository.ts). |
| **Adapter** | A class implementing a port, e.g. [`PrismaScheduleRepository`](../apps/svc-learning/src/infrastructure/prisma/schedule.prisma-repository.ts). |

## How Lingua uses it

Every service uses the **same four folders** under `src/`:

```
apps/svc-learning/src/
├── domain/          # entities, value objects, domain services, PORT interfaces
│   ├── schedule.entity.ts
│   ├── fsrs.domain-service.ts
│   └── ports/
│       ├── schedule.repository.ts       # interface + SCHEDULE_REPOSITORY token
│       └── review-outcome.writer.ts     # interface + REVIEW_OUTCOME_WRITER token
├── application/     # use-cases (one business action each) + their specs
│   ├── submit-review.usecase.ts
│   └── submit-review.usecase.spec.ts
├── infrastructure/  # ADAPTERS: Prisma repos, Kafka consumers, outbox store
│   ├── prisma/schedule.prisma-repository.ts
│   └── kafka/card-created.consumer.ts
├── interface/       # entry points: HTTP + gRPC controllers
│   ├── http/learning.controller.ts
│   └── grpc/learning.grpc-controller.ts
├── learning.module.ts   # composition root — binds tokens → adapters
└── main.ts              # bootstrap (HTTP + gRPC, logger, validation)
```

The dependency rule is enforced by where things `import` from: `domain/` imports nothing
from `infrastructure/`; `application/` depends on `domain/` ports only; `infrastructure/`
and `interface/` are the only layers that touch the framework edges.

### The module as a composition root

The module is where the abstract ports get bound to concrete adapters. This is the single
place that says "when someone asks for `SCHEDULE_REPOSITORY`, give them a
`PrismaScheduleRepository`". From [`learning.module.ts`](../apps/svc-learning/src/learning.module.ts):

```ts
@Module({
  controllers: [LearningController, LearningGrpcController, HealthController],
  providers: [
    FsrsService,
    SubmitReviewUseCase,
    PrismaService,
    { provide: SCHEDULE_REPOSITORY, useClass: PrismaScheduleRepository },
    { provide: REVIEW_OUTCOME_WRITER, useClass: PrismaReviewOutcomeWriter },
    { provide: OUTBOX_STORE, useExisting: PrismaOutboxStore },
    OutboxRelayService,
    // ...Kafka consumers
  ],
})
export class LearningModule {}
```

`{ provide: TOKEN, useClass: Adapter }` is the binding. Because the use-case depends on the
**token** (a `Symbol`), not on the adapter class, swapping the database implementation — or
substituting a fake in a test — changes exactly one line and nothing in the core.

### Why this makes use-cases testable

A use-case talks only to interfaces, so a unit test can pass tiny in-memory stand-ins instead
of real infrastructure. No database, no Kafka, no network — the test constructs the use-case
by hand and feeds it fakes. See "See it in action" below for the real test.

## Walk-through: one request through svc-learning

Scenario: the user reviewed a flashcard and graded how well they remembered it. The request
is `POST /internal/reviews/:cardId` with body `{ "grade": 3 }`.

**1. Interface layer — the HTTP controller.**
[`interface/http/learning.controller.ts`](../apps/svc-learning/src/interface/http/learning.controller.ts)
receives the request. Decorators map the route and pull data out of it:

```ts
@Controller('internal/reviews')
export class LearningController {
  constructor(
    private readonly getReviewQueue: GetReviewQueueUseCase,
    private readonly submitReview: SubmitReviewUseCase,
  ) {}

  @Post(':cardId')
  submit(
    @OwnerId() userId: string,            // custom decorator: reads x-owner-id header
    @Param('cardId') cardId: string,
    @Body() dto: SubmitReviewDto,
  ): Promise<NextSchedule> {
    if (![1, 2, 3, 4].includes(dto?.grade)) {
      throw new BadRequestException('grade must be 1|2|3|4');
    }
    return this.submitReview.execute(userId, cardId, dto.grade as ReviewGrade);
  }
}
```

The controller is thin: validate input, then delegate to a use-case. The `@OwnerId()` is a
custom parameter decorator defined in
[`owner-id.decorator.ts`](../apps/svc-learning/src/interface/http/owner-id.decorator.ts)
that extracts the `x-owner-id` header (the gateway has already authenticated the user).

**2. Application layer — the use-case.**
[`SubmitReviewUseCase`](../apps/svc-learning/src/application/submit-review.usecase.ts)
orchestrates the operation against ports and the domain:

```ts
const current = await this.schedules.findByUserAndCard(userId, cardId); // port
if (!current) throw new NotFoundException(...);

const now = new Date();
const next = current.applyReview(grade, this.fsrs, now);                // domain
// ...build the ReviewCompletedEvent...
await this.writer.commit(next, { userId, cardId, grade, reviewedAt: now }, event); // port
```

Notice: it never imports Prisma or Kafka. `this.schedules` and `this.writer` are ports;
`this.fsrs` is a domain service.

**3. Domain layer — the entity + domain service.**
[`Schedule`](../apps/svc-learning/src/domain/schedule.entity.ts) is an entity. Its
`applyReview` method asks the [`FsrsService`](../apps/svc-learning/src/domain/fsrs.domain-service.ts)
(spaced-repetition algorithm, wrapping the `ts-fsrs` library) to compute the next review
date, and returns a **new** `Schedule` — the math lives here, isolated from I/O.

**4. Infrastructure layer — the adapters.**
The port [`ScheduleRepository`](../apps/svc-learning/src/domain/ports/schedule.repository.ts)
is implemented by
[`PrismaScheduleRepository`](../apps/svc-learning/src/infrastructure/prisma/schedule.prisma-repository.ts),
which runs the actual SQL via Prisma. The
[`PrismaReviewOutcomeWriter`](../apps/svc-learning/src/infrastructure/prisma/review-outcome.prisma-writer.ts)
implements `ReviewOutcomeWriter` and, in **one database transaction**, updates the schedule,
inserts a review-log row, and writes an **outbox** row that will later be published to Kafka:

```ts
await this.prisma.$transaction(async (tx) => {
  await tx.cardSchedule.update({ ... });
  await tx.reviewLog.create({ ... });
  await tx.outbox.create({ data: { topic: event.type, key: ..., payload: event, ... } });
});
```

The transactional outbox pattern is covered in [05 — Messaging & Kafka](./05-messaging-kafka.md).

**5. Back up the stack.** The writer returns, the use-case builds a `NextSchedule` response,
the controller returns it, Nest serializes it to JSON. The same `SubmitReviewUseCase` is also
reachable over gRPC via
[`interface/grpc/learning.grpc-controller.ts`](../apps/svc-learning/src/interface/grpc/learning.grpc-controller.ts)
— a second adapter onto the *same* core (see [06 — gRPC & Contracts](./06-grpc-contracts.md)).

## Bootstrapping, dev runtime and build

[`main.ts`](../apps/svc-learning/src/main.ts) is the entry point. It creates the Nest app,
installs a global `ValidationPipe`, starts the gRPC microservice alongside HTTP, and listens:

```ts
const app = await NestFactory.create(LearningModule);
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
connectGrpcMicroservice(app, { /* package, protoPath, url */ });
await app.startAllMicroservices();
await app.listen(Number(process.env.SVC_LEARNING_PORT ?? 3103));
```

**Dev runtime uses SWC, not `ts-node`.** The `serve` target in
[`project.json`](../apps/svc-learning/project.json) runs:

```
node --env-file=../../.env --watch -r @swc-node/register src/main.ts
```

`-r @swc-node/register` transpiles TypeScript on the fly with SWC (fast, in Rust). The reason
SWC matters specifically here: NestJS DI relies on **decorator metadata** (`emitDecoratorMetadata`),
and `@swc-node/register` is configured to emit it, so constructor types like `ScheduleRepository`
are available at runtime for injection. `--watch` restarts on file changes.

**Build uses `tsc`** (plain TypeScript compiler), not SWC: the `build` target runs
`tsc -p tsconfig.app.json`, which type-checks and emits CommonJS to `dist/`. So: SWC for fast
local iteration, `tsc` for the type-checked production build (used by the Docker image — see
[11 — Docker](./11-docker.md)).

## Key files

| File | Role |
|---|---|
| [apps/svc-learning/src/learning.module.ts](../apps/svc-learning/src/learning.module.ts) | Composition root: binds port tokens → adapters. |
| [apps/svc-learning/src/main.ts](../apps/svc-learning/src/main.ts) | Bootstrap: HTTP + gRPC, validation, logger. |
| [apps/svc-learning/src/interface/http/learning.controller.ts](../apps/svc-learning/src/interface/http/learning.controller.ts) | HTTP entry point (thin adapter). |
| [apps/svc-learning/src/interface/http/owner-id.decorator.ts](../apps/svc-learning/src/interface/http/owner-id.decorator.ts) | Custom param decorator reading `x-owner-id`. |
| [apps/svc-learning/src/application/submit-review.usecase.ts](../apps/svc-learning/src/application/submit-review.usecase.ts) | The orchestrating use-case. |
| [apps/svc-learning/src/application/submit-review.usecase.spec.ts](../apps/svc-learning/src/application/submit-review.usecase.spec.ts) | Unit test with in-memory adapters. |
| [apps/svc-learning/src/domain/schedule.entity.ts](../apps/svc-learning/src/domain/schedule.entity.ts) | Entity with behaviour. |
| [apps/svc-learning/src/domain/fsrs.domain-service.ts](../apps/svc-learning/src/domain/fsrs.domain-service.ts) | Domain service over `ts-fsrs`. |
| [apps/svc-learning/src/domain/ports/schedule.repository.ts](../apps/svc-learning/src/domain/ports/schedule.repository.ts) | Port: interface + `SCHEDULE_REPOSITORY` token. |
| [apps/svc-learning/src/infrastructure/prisma/schedule.prisma-repository.ts](../apps/svc-learning/src/infrastructure/prisma/schedule.prisma-repository.ts) | Prisma adapter for the port. |
| [apps/svc-learning/src/infrastructure/prisma/review-outcome.prisma-writer.ts](../apps/svc-learning/src/infrastructure/prisma/review-outcome.prisma-writer.ts) | Transactional adapter (update + log + outbox). |
| [apps/svc-learning/project.json](../apps/svc-learning/project.json) | Nx targets: `serve` (SWC), `build` (tsc), `test`. |

Versions pinned in the root [package.json](../package.json): `@nestjs/core` / `@nestjs/common`
`11.1.26`, `@swc-node/register` `1.11.1`, `typescript ~5.9.2`, `ts-fsrs` `5.4.1`, Node `>=24`.

## See it in action

The unit test for the use-case constructs it **by hand** with fakes — no Nest, no DB, no Kafka.
From [`submit-review.usecase.spec.ts`](../apps/svc-learning/src/application/submit-review.usecase.spec.ts):

```ts
class InMemoryScheduleRepository implements ScheduleRepository {
  private store = new Map<string, Schedule>();
  // ...seed / findByUserAndCard / findDue / upsertDueNow backed by the Map
}
class RecordingWriter implements ReviewOutcomeWriter {
  committed = [];
  async commit(next, log, event) { this.committed.push({ next, log, event }); }
}

beforeEach(() => {
  repo   = new InMemoryScheduleRepository();
  writer = new RecordingWriter();
  useCase = new SubmitReviewUseCase(repo, writer, fsrs); // fakes injected manually
});
```

The test then asserts that grading a card recomputes the schedule via FSRS, emits a
`learning.review.completed` event, and returns the next due date — all in milliseconds.

Run it (from the repo root):

```bash
# install deps once (pnpm via corepack)
corepack pnpm install

# run svc-learning's tests
pnpm nx test svc-learning

# start the service in watch mode (needs .env + Postgres/Kafka up — see QUICKSTART)
pnpm nx serve svc-learning

# type-checked production build
pnpm nx build svc-learning
```

The service listens on `http://localhost:3103` (HTTP) and gRPC `:50053` by default. Bringing up
its dependencies (Postgres, Kafka, Keycloak) is described in [QUICKSTART](./QUICKSTART.md).

## Related

- [01 — Architecture](./01-architecture.md) — how the services fit together.
- [02 — Monorepo: Nx & pnpm](./02-monorepo-nx-pnpm.md) — targets, `nx affected`, workspace layout.
- [04 — Data: Prisma](./04-data-prisma.md) — the database side of the adapters above.
- [05 — Messaging: Kafka](./05-messaging-kafka.md) — the transactional outbox.
- [06 — gRPC & Contracts](./06-grpc-contracts.md) — the second adapter onto the same core.
- [07 — Auth: Keycloak](./07-auth-keycloak.md) — where `x-owner-id` comes from.

External:
- NestJS docs — https://docs.nestjs.com/
- Hexagonal architecture (Alistair Cockburn) — https://alistair.cockburn.us/hexagonal-architecture/
- Domain-Driven Design reference (Eric Evans) — https://www.domainlanguage.com/ddd/reference/
- `ts-fsrs` — https://github.com/open-spaced-repetition/ts-fsrs
