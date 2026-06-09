import { KafkaProducer } from './producer';

/**
 * A row in a service's `outbox` table. Written in the SAME transaction as the
 * domain change so the fact "this event must be published" is atomic with the
 * state change it describes.
 */
export interface OutboxRecord {
  id: string;
  topic: string;
  key: string;
  payload: unknown; // the DomainEvent envelope, stored as jsonb
}

/**
 * Storage port for the relay. Each service implements this against its own
 * Prisma client (db-per-service) — keeping libs/kafka free of any Prisma
 * dependency. Implementations must:
 *  - return only NOT-yet-published rows, oldest first, capped at `limit`;
 *  - mark rows published by id (idempotent).
 */
export interface OutboxStore {
  fetchUnpublished(limit: number): Promise<OutboxRecord[]>;
  markPublished(ids: string[]): Promise<void>;
}

export interface OutboxRelayOptions {
  /** Poll interval in ms (default 1000). */
  intervalMs?: number;
  /** Max rows per poll (default 100). */
  batchSize?: number;
  /** Optional logger; defaults to console. */
  logger?: { log: (m: string) => void; error: (m: string, e?: unknown) => void };
}

/**
 * Transactional-outbox relay.
 *
 * Polls the service's outbox for unpublished rows, publishes each to Kafka via
 * {@link KafkaProducer}, then marks the row published. This gives at-least-once
 * delivery without a distributed transaction between the database and Kafka:
 * if the process crashes after publishing but before marking, the row is
 * re-published on the next poll — which is why consumers dedup on `eventId`.
 *
 * A single batch is processed by {@link drainOnce}; {@link start} runs it on an
 * interval. Publishing is sequential to preserve per-key ordering within a
 * batch (rows are fetched oldest-first).
 */
export class OutboxRelay {
  private timer: NodeJS.Timeout | null = null;
  private draining = false;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly logger: NonNullable<OutboxRelayOptions['logger']>;

  constructor(
    private readonly store: OutboxStore,
    private readonly producer: KafkaProducer,
    options: OutboxRelayOptions = {},
  ) {
    this.intervalMs = options.intervalMs ?? 1000;
    this.batchSize = options.batchSize ?? 100;
    this.logger = options.logger ?? {
      log: (m) => console.log(`[outbox] ${m}`),
      error: (m, e) => console.error(`[outbox] ${m}`, e),
    };
  }

  /**
   * Publish one batch of unpublished rows. Returns the number published.
   * Stops at the first publish failure so the row is retried next poll
   * (preserves ordering, avoids skipping).
   */
  async drainOnce(): Promise<number> {
    const rows = await this.store.fetchUnpublished(this.batchSize);
    if (rows.length === 0) return 0;

    const publishedIds: string[] = [];
    for (const row of rows) {
      try {
        await this.producer.send({ topic: row.topic, key: row.key, value: row.payload });
        publishedIds.push(row.id);
      } catch (err) {
        this.logger.error(`failed to publish outbox row ${row.id}; will retry`, err);
        break;
      }
    }

    if (publishedIds.length > 0) {
      await this.store.markPublished(publishedIds);
      this.logger.log(`published ${publishedIds.length} event(s)`);
    }
    return publishedIds.length;
  }

  /** Start polling. Idempotent. */
  start(): void {
    if (this.timer) return;
    const tick = async () => {
      if (this.draining) return;
      this.draining = true;
      try {
        await this.drainOnce();
      } catch (err) {
        this.logger.error('relay tick failed', err);
      } finally {
        this.draining = false;
      }
    };
    this.timer = setInterval(tick, this.intervalMs);
    // don't keep the event loop alive solely for the relay
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
