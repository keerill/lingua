# 01 — System Architecture

This is the bird's-eye view of how Lingua is built: many small backend services, each
owning its own database, talking to each other through a mix of direct calls and
asynchronous events, with a single gateway in front of the browser.

## What is it

A **monolith** is one program that does everything: one codebase, one process, one
database. That is simple to start but gets hard to grow — every change risks breaking
something unrelated, and you have to deploy and scale the whole thing at once.

A **microservice architecture** splits the system into several small programs, each
responsible for one part of the business. In Lingua:

- one service owns the **vocabulary** (decks and cards),
- another owns the **review schedule** (when each card is next due),
- another runs the **AI conversation**,
- and so on.

Each service is a separate process you can develop, test, deploy, and scale on its own.
The trade-off is that the parts now have to talk over the network, which introduces the
real subject of this document: how they communicate.

Three patterns do all the heavy lifting:

1. **Database-per-service.** Every service has its *own* database and nobody else is
   allowed to touch it. The only way to read another service's data is to *ask that
   service*. This keeps each service's internal schema private, so one team can change
   its tables without breaking everyone else. The cost is that there is no single
   `JOIN` across services — you assemble data by making calls.

2. **Backend-for-frontend (BFF).** The browser does not talk to nine services directly.
   It talks to exactly one — the **gateway-bff** — which checks who you are, fans the
   request out to the services it needs, and returns one tidy response. The browser
   sees a simple, stable API; the messiness of "which service owns what" stays on the
   server.

3. **Synchronous vs. asynchronous communication.**
   - *Synchronous* means "I call you and wait for the answer right now." Lingua uses
     **gRPC** for internal service-to-service calls and **REST/WebSocket** for the
     browser ↔ BFF edge. Used when the caller needs the answer to continue.
   - *Asynchronous* means "I record that something happened and move on; whoever cares
     will react later." Lingua does this with **events** on **Apache Kafka**. Used when
     a fact ("a mistake was detected") should trigger work in other services without the
     original request having to wait for them.

## How Lingua uses it

### The system at a glance

```
                                  Browser
                                     │
            ┌────────────────────────┼─────────────────────────┐
            │                        │                         │
      shell :4200              gateway-bff :3000          web-public :4205
   + mfe-* :4201–4204         (REST + WebSocket)          (Next.js SSR,
   (Module Federation)              │                      standalone)
                                    │ gRPC (internal sync)
   ┌───────────┬──────────┬─────────┼──────────┬───────────┬──────────────┐
 identity   vocabulary  learning  ai-dialog  speech     content      progress
  :3101       :3102      :3103     :3104      :3105      :3106         :3107
   │           │          │         │                                 notifications
   │           │          │         │                                  :3108
   │  each service owns its own PostgreSQL database (database-per-service)
   │           │          │         │
   └───────────┴────┬─────┴─────────┘
                    │  facts published via transactional outbox
                    ▼
               Apache Kafka  ──►  consumers in other services react
```

Edge traffic from the browser is **REST + WebSocket** to the BFF only. Internal
service-to-service reads are **gRPC**. State changes that other services care about are
broadcast as **Kafka events**.

### The services

Ports below are the development defaults from [.env.example](../.env.example).

| Service | Port | Owns / responsibility |
|---|---|---|
| `gateway-bff` | 3000 | The only backend the browser talks to. Validates the Keycloak token, aggregates reads, proxies to services over gRPC, hosts the speaking WebSocket. |
| `svc-identity` | 3101 | User profile/identity data backed by Keycloak. |
| `svc-vocabulary` | 3102 | Decks and flashcards. Seeds the "Speaking practice" deck from conversation mistakes. |
| `svc-learning` | 3103 | The FSRS review schedule: when each card is next due, and recording review outcomes. |
| `svc-ai-dialog` | 3104 | Runs the AI conversation turn: streams the LLM reply and detects mistakes. |
| `svc-speech` | 3105 | Speech-to-text and text-to-speech (behind ports, with offline fakes). |
| `svc-content` | 3106 | Conversation scenarios, lessons, and deck templates (the Studio editing target). |
| `svc-progress` | 3107 | A read-model built from the event stream: streaks, words learned, reviews per day, pronunciation trend. |
| `svc-notifications` | 3108 | Scheduled reminders; consumes review/flag events and emits `notification.sent`. |

Frontends and the public site:

| App | Port | Role |
|---|---|---|
| `shell` | 4200 | Module Federation **host** — the app frame that loads the remotes. |
| `mfe-learner` | 4201 | Flashcard review UI. |
| `mfe-speaking` | 4202 | Live conversation UI. |
| `mfe-progress` | 4203 | Progress charts. |
| `mfe-studio` | 4204 | Admin scenario editor (`admin` role). |
| `web-public` | 4205 | Next.js SSR marketing/SEO site, **separate** from Module Federation. |

### Synchronous path: reviewing a card

When you grade a flashcard in `mfe-learner`, the request is purely synchronous up to the
point where the schedule is updated:

```
Browser ──REST──► gateway-bff ──gRPC──► svc-learning
                                            │
                                            ├─ recompute next due date (FSRS, ts-fsrs)
                                            ├─ persist the new schedule
                                            └─ write a learning.review.completed event
                                               into its OUTBOX  (same DB transaction)
```

The interesting detail is the last line. The service does **not** call Kafka itself
inside the request. Instead, in the *same database transaction* that updates the
schedule, it inserts a row into an **outbox** table describing the event. See
[apps/svc-learning/src/application/submit-review.usecase.ts](../apps/svc-learning/src/application/submit-review.usecase.ts):
the use case computes the next schedule, builds a `ReviewCompletedEvent` of type
`learning.review.completed`, and hands both to a writer that commits them together.

A separate **relay** later reads the outbox and publishes to Kafka. This is the
**transactional outbox** pattern, and it guarantees a fact and its event are saved
atomically — you can never end up with the schedule updated but the event lost, or vice
versa. (Details in [./05-messaging-kafka.md](./05-messaging-kafka.md).)

`svc-progress` consumes `learning.review.completed` asynchronously and updates its charts;
the browser does not wait for that.

### Asynchronous path: a speaking turn and the feedback loop

This is the flow that shows off the whole architecture. You speak; the system replies;
and if you made a mistake, that mistake *quietly turns into a flashcard that becomes due
immediately* — without the conversation ever pausing.

```
  Browser ──WebSocket──► gateway-bff ──► svc-ai-dialog.RunTurnUseCase
                                            │
                       (1) STT via svc-speech, scenario via svc-content
                       (2) stream LLM reply tokens back to the browser
                       (3) detect mistakes in the user's text
                            │
                            └─ if mistakes: write speaking.mistake.detected
                               into the OUTBOX (with the saved turn)  ── async ──┐
                                                                                 │
   ┌─────────────────────────────────────────────────────────────────────────  │
   ▼  Kafka topic: speaking.mistake.detected                                    │
  svc-vocabulary  (IngestSpeakingMistakesUseCase)                               │
   ├─ find-or-create the user's "Speaking practice" deck                        │
   ├─ create cards for new mistaken terms                                       │
   └─ publish vocabulary.cards.flagged (cardIds)  via OUTBOX  ── async ──┐      │
                                                                         │      │
   ┌──────────────────────────────────────────────────────────────────  │      │
   ▼  Kafka topic: vocabulary.cards.flagged                              │      │
  svc-learning  (FlagCardsDueUseCase)                                    │      │
   └─ upsert each card's schedule with due = now  ◄── card is due NOW ───┘      │
                                                                                │
  Loop closed: the next time mfe-learner loads the queue, the word you ◄────────┘
  stumbled on while speaking is waiting to be reviewed.
```

Where each step actually lives:

- **Run the turn and emit the mistake event.**
  [apps/svc-ai-dialog/src/application/run-turn.usecase.ts](../apps/svc-ai-dialog/src/application/run-turn.usecase.ts).
  It loads the scenario, streams the LLM reply, runs the mistake detector, and — only if
  `mistakes.length > 0` — builds a `SpeakingMistakeDetectedEvent` and appends it alongside
  the saved turn (so the turn and its outbox event commit together).

- **Seed/flag the cards.**
  [apps/svc-vocabulary/src/application/ingest-speaking-mistakes.usecase.ts](../apps/svc-vocabulary/src/application/ingest-speaking-mistakes.usecase.ts).
  It calls `findOrCreateSpeakingDeck`, creates a `Card` for each *new* mistaken term
  (deduping against existing ones), and publishes `vocabulary.cards.flagged` carrying the
  full list of `cardIds` (existing + new).

- **Make the cards due now.**
  [apps/svc-learning/src/infrastructure/kafka/cards-flagged.consumer.ts](../apps/svc-learning/src/infrastructure/kafka/cards-flagged.consumer.ts)
  subscribes to `vocabulary.cards.flagged` and calls
  [apps/svc-learning/src/application/flag-cards-due.usecase.ts](../apps/svc-learning/src/application/flag-cards-due.usecase.ts),
  which does `upsertDueNow(...)` for every flagged card — setting `due = now`.

The three topic names are defined once, as a single source of truth, in
[libs/contracts/src/events.ts](../libs/contracts/src/events.ts):

```ts
LearningReviewCompleted: 'learning.review.completed',
SpeakingMistakeDetected: 'speaking.mistake.detected',
VocabularyCardsFlagged:  'vocabulary.cards.flagged',
```

Notice that no service in this chain knows about the others. `svc-ai-dialog` does not
call `svc-vocabulary`; it just publishes a fact. `svc-vocabulary` does not call
`svc-learning`; it publishes another fact. This **loose coupling** is the whole point of
event-driven design: you can add a new consumer (say, a fourth service that emails you a
weekly mistakes digest) without touching any existing code.

### Why split it this way

- **Independent failure.** If the AI dialog provider is slow, card review still works.
- **Independent change.** `svc-progress` can redesign its tables freely because it owns
  them and only reacts to events.
- **Clear ownership.** Each service maps to one bounded part of the domain (a DDD idea):
  vocabulary, scheduling, conversation, content, progress.
- **It demonstrates distributed-systems patterns** end to end, which is an explicit goal
  of the project.

## Key files

| Path | What it is |
|---|---|
| [.env.example](../.env.example) | All service ports, database URLs, and internal URLs. |
| [README.md](../README.md) | Project overview and the run instructions. |
| [libs/contracts/src/events.ts](../libs/contracts/src/events.ts) | Kafka topic names and event types — the shared contract. |
| [apps/svc-learning/src/application/submit-review.usecase.ts](../apps/svc-learning/src/application/submit-review.usecase.ts) | The synchronous "review a card" use case + outbox write. |
| [apps/svc-ai-dialog/src/application/run-turn.usecase.ts](../apps/svc-ai-dialog/src/application/run-turn.usecase.ts) | Runs a speaking turn, emits `speaking.mistake.detected`. |
| [apps/svc-vocabulary/src/application/ingest-speaking-mistakes.usecase.ts](../apps/svc-vocabulary/src/application/ingest-speaking-mistakes.usecase.ts) | Seeds the deck and emits `vocabulary.cards.flagged`. |
| [apps/svc-learning/src/infrastructure/kafka/cards-flagged.consumer.ts](../apps/svc-learning/src/infrastructure/kafka/cards-flagged.consumer.ts) | Consumes the flag event and marks cards due now. |
| [apps/svc-learning/src/application/flag-cards-due.usecase.ts](../apps/svc-learning/src/application/flag-cards-due.usecase.ts) | `upsertDueNow` — the end of the feedback loop. |

## See it in action

```bash
# From the repo root. Requires Node 24, pnpm 11 (via corepack), Docker.

# 1. Install dependencies
corepack enable
pnpm install

# 2. Start infrastructure (Postgres, Kafka, Redis, Keycloak, MinIO)
docker compose -f infra/docker/docker-compose.dev.yml up -d

# 3. Generate Prisma clients and migrate each service's database
pnpm nx run-many -t prisma-generate
pnpm nx run svc-learning:prisma-migrate
pnpm nx run svc-vocabulary:prisma-migrate
pnpm nx run svc-ai-dialog:prisma-migrate

# 4. Run everything (all services + frontends) in parallel
pnpm nx run-many -t serve --parallel=16
# Then open the shell at http://localhost:4200
```

To watch the feedback loop end to end, run the BFF e2e flow, which drives a review and a
speaking turn through the gateway:

```bash
pnpm nx e2e gateway-bff-e2e
```

## Related

- [./02-monorepo-nx-pnpm.md](./02-monorepo-nx-pnpm.md) — how the repo and build are organized.
- [./03-backend-nestjs.md](./03-backend-nestjs.md) — the Hexagonal/DDD structure inside each service.
- [./05-messaging-kafka.md](./05-messaging-kafka.md) — Kafka and the transactional outbox in detail.
- [./06-grpc-contracts.md](./06-grpc-contracts.md) — internal synchronous calls and shared contracts.
- [./07-auth-keycloak.md](./07-auth-keycloak.md) — how the BFF authenticates the browser.
- [./08-frontend-mfe.md](./08-frontend-mfe.md) — the shell + micro-frontends.
- [../README.md](../README.md) and [./QUICKSTART.md](./QUICKSTART.md) — getting it running.

External reading:

- [Microservices, martinfowler.com](https://martinfowler.com/articles/microservices.html)
- [Pattern: Database per service (microservices.io)](https://microservices.io/patterns/data/database-per-service.html)
- [Pattern: Transactional outbox (microservices.io)](https://microservices.io/patterns/data/transactional-outbox.html)
