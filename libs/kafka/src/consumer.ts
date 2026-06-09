import type { KafkaJS } from '@confluentinc/kafka-javascript';
import { createKafka, KafkaClientConfig } from './client';

export interface KafkaConsumerConfig extends KafkaClientConfig {
  /** Consumer group id (db-per-service → one group per consuming service). */
  groupId: string;
}

/** Handler invoked per message. `value` is the parsed JSON payload. */
export type MessageHandler = (msg: {
  topic: string;
  key: string | null;
  value: unknown;
}) => Promise<void>;

/**
 * Thin wrapper around a Confluent consumer. Parses JSON values and dispatches
 * to a single handler. Offsets auto-commit (at-least-once): handlers MUST be
 * idempotent — consumers dedup on the event envelope's `eventId`.
 */
export class KafkaConsumer {
  private consumer: KafkaJS.Consumer | null = null;
  private readonly kafka: KafkaJS.Kafka;

  constructor(private readonly config: KafkaConsumerConfig) {
    this.kafka = createKafka(config);
  }

  async connect(): Promise<void> {
    if (this.consumer) return;
    this.consumer = this.kafka.consumer({
      kafkaJS: { groupId: this.config.groupId, fromBeginning: true },
      // Discover newly-created topics quickly. librdkafka defaults to a 5-min
      // metadata refresh, so a consumer that subscribes before its topic exists
      // (common at first boot) would otherwise lag minutes before consuming.
      'topic.metadata.refresh.interval.ms': 5000,
    });
    await this.consumer.connect();
  }

  async subscribe(topics: string[], handler: MessageHandler): Promise<void> {
    if (!this.consumer) {
      throw new Error('KafkaConsumer.subscribe called before connect()');
    }
    await this.consumer.subscribe({ topics });
    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        const raw = message.value?.toString('utf8');
        const value = raw ? JSON.parse(raw) : null;
        await handler({
          topic,
          key: message.key?.toString('utf8') ?? null,
          value,
        });
      },
    });
  }

  async disconnect(): Promise<void> {
    if (!this.consumer) return;
    await this.consumer.disconnect();
    this.consumer = null;
  }
}
