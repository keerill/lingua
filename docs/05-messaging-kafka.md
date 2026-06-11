# 05 — Messaging with Kafka (events + the outbox)

This document explains how Lingua's services talk to each other *without waiting* for one
another: by recording facts as **events** and putting them on **Apache Kafka**. It also
explains the one tricky problem this raises — keeping your database and your event stream
in agreement — and the **transactional outbox** pattern Lingua uses to solve it.

If you have never used a message broker before, read the next section first; everything
afterwards builds on it.

## What is it

### A message broker, from first principles

Imagine two services. Service A finishes some work and service B needs to know about it.

The obvious approach is a direct call: A phones B and waits for B to answer. That works,
but it couples them tightly — if B is slow or down, A is stuck. And if a *third* service
C later also wants to know, you have to change A to call C too.

A **message broker** removes that coupling. Instead of calling B directly, A drops a small
message into a named mailbox and moves on immediately. B (and C, and anyone else) reads
from that mailbox on its own schedule. A doesn't know or care who is listening. **Kafka**
is such a broker.

The core vocabulary:

- **Topic** — a named, append-only log of messages (the "mailbox"). Lingua has one topic
  per kind of fact, e.g. `speaking.mistake.detected`.
- **Producer** — code that appends a message to a topic.
- **Consumer** — code that reads messages from a topic.
- **Partition** — a topic can be split into parallel sub-logs for throughput. Lingua uses
  **one partition per topic** (see the topic setup below), which keeps things simple and
  preserves message order.
- **Offset** — each message in a partition has a sequential position. A consumer remembers
  the offset it has read up to, so it can resume exactly where it left off after a restart.
- **Consumer group** — consumers that share a `groupId` split the partitions between them,
  so each message is processed once *per group*. Two *different* groups each get their own
  full copy of the stream. In Lingua each subscribing service uses its own group id, so
  every service independently sees every relevant event.

Kafka here runs in **KRaft mode** — a single node that is both broker and controller, with
**no ZooKeeper** (the old external coordinator Kafka used to require). The client library
is **`@confluentinc/kafka-javascript`** (Confluent's official binding), *not* KafkaJS and
*not* NestJS's built-in Kafka transport.

### At-least-once delivery (why consumers must be idempotent)

Kafka guarantees **at-least-once** delivery: a message will be delivered, but on retries
or rebalances it can occasionally be delivered *more than once*. Consumers must therefore
be **idempotent** — processing the same event twice must produce the same result as
processing it once. Lingua does this by giving every event an `eventId` and having
consumers deduplicate on it (and by writing operations as upserts).

### Why events at all?

Two reasons, both visible in Lingua's feedback loop below:

- **Decoupling.** The service that detects a speaking mistake does not need to know that
  vocabulary cards get seeded, that a review schedule gets bumped, or that a reminder gets
  sent. It just announces "a mistake happened." New reactions can be added later without
  touching the producer.
- **Asynchrony.** The user's conversation turn returns immediately; the downstream work
  (creating cards, rescheduling reviews) happens in the background.

## How Lingua uses it

### The topics

The full list lives in [`libs/contracts/src/events.ts`](../libs/contracts/src/events.ts)
as the `Topics` constant, and the matching TypeScript payload types live beside it. The
topics are:

| Topic | Produced by | Meaning |
| --- | --- | --- |
| `vocabulary.card.created` | svc-vocabulary | a new card was added |
| `learning.review.completed` | svc-learning | a card was reviewed (with FSRS snapshot) |
| `speaking.mistake.detected` | svc-ai-dialog | the AI spotted mistakes in a conversation |
| `vocabulary.cards.flagged` | svc-vocabulary | cards were flagged for urgent review |
| `content.scenario.updated` | svc-content | a scenario was upserted or deleted |
| `notification.sent` | svc-notifications | a reminder was dispatched |

Every event shares one envelope shape (`DomainEvent`): `eventId`, `type` (the topic name),
`occurredAt`, and a typed `payload`. Because the whole backend is TypeScript, these types
*are* the contract — no code generation is needed for the JSON path.

### The transactional outbox problem

Here is the subtle bug that the outbox pattern exists to prevent.

When svc-vocabulary ingests a speaking mistake it must do **two** things: write new card
rows to its Postgres database, *and* publish events to Kafka. The naive code is:

```ts
await db.insert(card);     // 1. write to Postgres
await kafka.publish(event); // 2. publish to Kafka
```

These are two separate systems, so there is no single transaction spanning both. Any of
these can happen:

- Step 1 succeeds, the process crashes before step 2 → the card exists but **no event was
  ever published**. The schedule never gets bumped. The fact is silently lost.
- Step 2 succeeds, then the DB transaction rolls back → an event was published for a card
  that **doesn't exist**. Consumers act on a phantom.

You cannot atomically write to a database *and* a broker. So Lingua never tries to.

### The outbox solution

The trick: make publishing an event a **database write**, so it lives inside the same
transaction as the business data. Then a separate process moves those rows to Kafka.

1. **Write phase (atomic).** In one Postgres transaction, the service writes both the
   business rows **and** a row into an `outbox` table describing the event to publish. If
   the transaction commits, both are saved; if it rolls back, neither is. They can never
   disagree.

   See [`apps/svc-vocabulary/src/infrastructure/prisma/card.prisma-repository.ts`](../apps/svc-vocabulary/src/infrastructure/prisma/card.prisma-repository.ts).
   Its `ingestMistakeCards` does exactly this inside `prisma.$transaction`:

   ```ts
   await this.prisma.$transaction(async (tx) => {
     await tx.card.createMany({ data: /* new cards */ });
     await tx.outbox.createMany({ data: /* card.created events */ });
     await tx.outbox.create({ data: /* the cards.flagged event */ });
   });
   ```

   Note the `headers: traceHeaders()` column written with each row — that captures the
   current W3C `traceparent` so a distributed trace survives the async hop (see
   [13-observability](./13-observability.md)).

2. **Relay phase (best-effort, retried).** A background **relay** polls the outbox table
   for rows that have not been published yet, sends them to Kafka, and only then marks them
   published. If the broker is down, the rows simply stay unpublished and are retried on
   the next tick — nothing is lost.

   The relay lives in [`libs/kafka/src/outbox.ts`](../libs/kafka/src/outbox.ts). Its
   `drainOnce()` fetches a batch, publishes each row (re-injecting the captured trace
   headers via `publishWithSpan`), and on the first failure **stops the batch** so order
   is preserved and the row is retried later:

   ```ts
   const rows = await this.store.fetchUnpublished(this.batchSize);
   for (const row of rows) {
     await publishWithSpan({ topic: row.topic, key: row.key,
       parentHeaders: row.headers }, (headers) =>
       this.producer.send({ topic: row.topic, key: row.key,
         value: row.payload, headers }));
     publishedIds.push(row.id);
   }
   await this.store.markPublished(publishedIds);
   ```

   The `OutboxStore` interface is just two methods — `fetchUnpublished` and
   `markPublished` — and each service implements them against its own DB. The vocabulary
   implementation is
   [`prisma-outbox.store.ts`](../apps/svc-vocabulary/src/infrastructure/kafka/prisma-outbox.store.ts):
   it selects rows `where: { publishedAt: null }` ordered oldest-first, and marks them by
   stamping `publishedAt`.

3. **Wiring.** Inside NestJS the relay is started as a lifecycle service,
   [`libs/kafka/src/nest/outbox-relay.service.ts`](../libs/kafka/src/nest/outbox-relay.service.ts),
   which spins up the relay on application bootstrap (default tick: every 1000 ms) and
   stops it on shutdown. The producer it uses is provided by
   [`kafka.module.ts`](../libs/kafka/src/nest/kafka.module.ts) (`KafkaModule.forRoot`),
   which also chooses the serializer (JSON by default — see Schema Registry below).

This enforces a hard rule across the codebase: *publishing to Kafka happens only through
the outbox.* Services never call the producer directly from business code.

### Walking the feedback loop end to end

This is the signature flow of the whole product — a spoken mistake turning into a due
flashcard. Follow it topic by topic:

1. **svc-ai-dialog** finishes a conversation turn, detects weak words, and (via its own
   outbox) publishes **`speaking.mistake.detected`** with the user id and a list of
   mistakes.

2. **svc-vocabulary** consumes it. The consumer
   [`speaking-mistake.consumer.ts`](../apps/svc-vocabulary/src/infrastructure/kafka/speaking-mistake.consumer.ts)
   subscribes with group id `svc-vocabulary`, guards on `event.type`, and hands the
   payload to
   [`ingest-speaking-mistakes.usecase.ts`](../apps/svc-vocabulary/src/application/ingest-speaking-mistakes.usecase.ts).
   That use-case finds-or-creates a "Speaking practice" deck, creates a card for each new
   term, and — in the single transaction shown above — writes **`vocabulary.card.created`**
   events for the new cards and one **`vocabulary.cards.flagged`** event listing all the
   relevant card ids.

3. **svc-learning** consumes `vocabulary.cards.flagged`. The consumer
   [`cards-flagged.consumer.ts`](../apps/svc-learning/src/infrastructure/kafka/cards-flagged.consumer.ts)
   (group id `svc-learning-cards-flagged`) calls
   [`flag-cards-due.usecase.ts`](../apps/svc-learning/src/application/flag-cards-due.usecase.ts),
   which upserts each card's schedule so its **`due` is now** — forcing the flagged cards
   to the front of the review queue.

The result: a word the learner stumbled over in conversation reappears in their review
deck almost immediately, and no service had to know about the others. (The same
`speaking.mistake.detected` topic is also consumed independently by **svc-progress** for
its pronunciation read-model — a second consumer group on the same stream, costing the
producer nothing.)

### The serializer seam

How an event's bytes are encoded sits behind a tiny `KafkaSerde` interface
([`libs/kafka/src/serde.ts`](../libs/kafka/src/serde.ts)): `serialize(topic, value)` and
`deserialize(topic, data)`. The default is `jsonSerde` — plain `JSON.stringify`. Producer
and consumer both pick their serde via
[`serde-factory.ts`](../libs/kafka/src/serde-factory.ts), which returns JSON unless the
`SCHEMA_REGISTRY_URL` environment variable is set (see the next section). Because this seam
sits *below* the relay, switching encodings never touches outbox or business code.

## Key files

- [`libs/contracts/src/events.ts`](../libs/contracts/src/events.ts) — the `Topics`
  constant and the TypeScript payload types; the single source of truth for JSON events.
- [`libs/kafka/src/client.ts`](../libs/kafka/src/client.ts) — builds the
  `@confluentinc/kafka-javascript` client (broker list, optional SSL/SASL for managed
  Kafka).
- [`libs/kafka/src/producer.ts`](../libs/kafka/src/producer.ts) — thin producer
  (`acks: -1` for durability); serializes through the chosen serde.
- [`libs/kafka/src/consumer.ts`](../libs/kafka/src/consumer.ts) — thin consumer; reads
  `fromBeginning`, deserializes, and wraps each message in a trace span.
- [`libs/kafka/src/outbox.ts`](../libs/kafka/src/outbox.ts) — the `OutboxStore` interface
  and the `OutboxRelay` poll-and-publish loop.
- [`libs/kafka/src/nest/outbox-relay.service.ts`](../libs/kafka/src/nest/outbox-relay.service.ts),
  [`libs/kafka/src/nest/kafka.module.ts`](../libs/kafka/src/nest/kafka.module.ts) — NestJS
  wiring for the relay and producer.
- [`libs/kafka/src/serde.ts`](../libs/kafka/src/serde.ts),
  [`libs/kafka/src/serde-factory.ts`](../libs/kafka/src/serde-factory.ts),
  [`libs/kafka/src/schema-registry.serde.ts`](../libs/kafka/src/schema-registry.serde.ts)
  — the JSON serializer, the env-driven chooser, and the optional Protobuf one.
- Producer side: [`apps/svc-vocabulary/src/infrastructure/prisma/card.prisma-repository.ts`](../apps/svc-vocabulary/src/infrastructure/prisma/card.prisma-repository.ts),
  [`apps/svc-vocabulary/src/infrastructure/kafka/prisma-outbox.store.ts`](../apps/svc-vocabulary/src/infrastructure/kafka/prisma-outbox.store.ts).
- Consumer side: [`apps/svc-vocabulary/src/infrastructure/kafka/speaking-mistake.consumer.ts`](../apps/svc-vocabulary/src/infrastructure/kafka/speaking-mistake.consumer.ts),
  [`apps/svc-learning/src/infrastructure/kafka/cards-flagged.consumer.ts`](../apps/svc-learning/src/infrastructure/kafka/cards-flagged.consumer.ts).
- [`infra/docker/docker-compose.dev.yml`](../infra/docker/docker-compose.dev.yml) — the
  Kafka broker (`kafka` service) and the one-shot `kafka-setup` that pre-creates topics.

## See it in action

Bring the dev infrastructure up (Kafka, Postgres, Keycloak, …):

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

The broker runs as `apache/kafka:3.9.0` in KRaft mode, advertised at `localhost:9092`. A
one-shot `kafka-setup` container then creates every topic (one partition, replication
factor 1). You can confirm they exist:

```bash
docker exec -it lingua-kafka \
  /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
```

Tail a topic live to watch events flow as you use the app. For the loop above, watch the
flagged-cards topic, then trigger a speaking turn in the UI:

```bash
docker exec -it lingua-kafka \
  /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic vocabulary.cards.flagged \
    --from-beginning --property print.key=true
```

You can do the same for `speaking.mistake.detected` or `learning.review.completed` to see
each hop of the feedback loop. Inspect a consumer group's progress (and lag) with:

```bash
docker exec -it lingua-kafka \
  /opt/kafka/bin/kafka-consumer-groups.sh \
    --bootstrap-server localhost:9092 \
    --describe --group svc-learning-cards-flagged
```

### Optional: Schema Registry (Protobuf events)

By default events travel as JSON. If you set `SCHEMA_REGISTRY_URL` (and run the registry —
there is a dedicated compose profile and Helm subchart), the serde factory swaps in
[`schema-registry.serde.ts`](../libs/kafka/src/schema-registry.serde.ts). It encodes each
event as **Protobuf** using the Confluent registry, mapping each topic to a generated
message type and auto-registering the schema under `<topic>-value`. This is opt-in and
purely below the outbox — turning it on changes nothing in your business or relay code.
The Protobuf message definitions are the language-neutral mirror of `events.ts`; see
[06-grpc-contracts](./06-grpc-contracts.md).

## Related

- [01-architecture](./01-architecture.md) — sync vs. async, where events fit.
- [03-backend-nestjs](./03-backend-nestjs.md) — the hexagonal layering of producers and
  consumers.
- [04-data-prisma](./04-data-prisma.md) — the `outbox` table and Prisma transactions.
- [06-grpc-contracts](./06-grpc-contracts.md) — the Protobuf event schemas and the
  Schema Registry path.
- [13-observability](./13-observability.md) — how trace context rides through Kafka via
  the `outbox.headers` column.
