import type { KafkaJS } from '@confluentinc/kafka-javascript';
import { consumeWithSpan } from '@lingua/observability';
import { createKafka, KafkaClientConfig } from './client';
import { type KafkaSerde } from './serde';
import { resolveSerde } from './serde-factory';

export interface KafkaConsumerConfig extends KafkaClientConfig {
  groupId: string;

  serde?: KafkaSerde;
}

export type MessageHandler = (msg: {
  topic: string;
  key: string | null;
  value: unknown;
}) => Promise<void>;

type RawHeaders = Record<
  string,
  Buffer | string | (Buffer | string)[] | undefined
>;

function toCarrier(headers: RawHeaders | undefined): Record<string, string> {
  const carrier: Record<string, string> = {};
  if (!headers) return carrier;
  for (const [k, v] of Object.entries(headers)) {
    if (v == null) continue;
    const first = Array.isArray(v) ? v[0] : v;
    if (first != null) carrier[k] = first.toString();
  }
  return carrier;
}

export class KafkaConsumer {
  private consumer: KafkaJS.Consumer | null = null;
  private readonly kafka: KafkaJS.Kafka;
  private readonly serde: KafkaSerde;

  constructor(private readonly config: KafkaConsumerConfig) {
    this.kafka = createKafka(config);
    this.serde = config.serde ?? resolveSerde();
  }

  async connect(): Promise<void> {
    if (this.consumer) return;
    this.consumer = this.kafka.consumer({
      kafkaJS: { groupId: this.config.groupId, fromBeginning: true },
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
        const value = message.value
          ? await this.serde.deserialize(topic, message.value)
          : null;
        await consumeWithSpan(
          { topic, headers: toCarrier(message.headers as RawHeaders) },
          () =>
            handler({
              topic,
              key: message.key?.toString('utf8') ?? null,
              value,
            }),
        );
      },
    });
  }

  async disconnect(): Promise<void> {
    if (!this.consumer) return;
    await this.consumer.disconnect();
    this.consumer = null;
  }
}
