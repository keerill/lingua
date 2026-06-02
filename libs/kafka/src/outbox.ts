import { publishWithSpan } from '@lingua/observability';
import { KafkaProducer } from './producer';

export interface OutboxRecord {
  id: string;
  topic: string;
  key: string;
  payload: unknown;

  headers?: Record<string, string> | null;
}

export interface OutboxStore {
  fetchUnpublished(limit: number): Promise<OutboxRecord[]>;
  markPublished(ids: string[]): Promise<void>;
}

export interface OutboxRelayOptions {
  intervalMs?: number;

  batchSize?: number;

  logger?: {
    log: (m: string) => void;
    error: (m: string, e?: unknown) => void;
  };
}

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

  async drainOnce(): Promise<number> {
    const rows = await this.store.fetchUnpublished(this.batchSize);
    if (rows.length === 0) return 0;

    const publishedIds: string[] = [];
    for (const row of rows) {
      try {
        await publishWithSpan(
          { topic: row.topic, key: row.key, parentHeaders: row.headers },
          (headers) =>
            this.producer.send({
              topic: row.topic,
              key: row.key,
              value: row.payload,
              headers,
            }),
        );
        publishedIds.push(row.id);
      } catch (err) {
        this.logger.error(
          `failed to publish outbox row ${row.id}; will retry`,
          err,
        );
        break;
      }
    }

    if (publishedIds.length > 0) {
      await this.store.markPublished(publishedIds);
      this.logger.log(`published ${publishedIds.length} event(s)`);
    }
    return publishedIds.length;
  }

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
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
