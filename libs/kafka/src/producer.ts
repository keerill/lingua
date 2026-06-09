import type { KafkaJS } from '@confluentinc/kafka-javascript';
import { createKafka, KafkaClientConfig } from './client';

/** A message ready to be published: topic, partition key, JSON-serializable value. */
export interface OutgoingMessage {
  topic: string;
  key: string;
  value: unknown;
}

/**
 * Thin wrapper around a Confluent producer. Serializes values to JSON and
 * publishes with `acks: all` semantics (the default of the compat layer).
 * Used by the {@link OutboxRelay}; never publish to Kafka directly from domain
 * code — always go through the outbox.
 */
export class KafkaProducer {
  private producer: KafkaJS.Producer | null = null;
  private readonly kafka: KafkaJS.Kafka;

  constructor(config: KafkaClientConfig) {
    this.kafka = createKafka(config);
  }

  async connect(): Promise<void> {
    if (this.producer) return;
    this.producer = this.kafka.producer({ kafkaJS: { acks: -1 } });
    await this.producer.connect();
  }

  async disconnect(): Promise<void> {
    if (!this.producer) return;
    await this.producer.disconnect();
    this.producer = null;
  }

  /** Publish a single message. Throws if not connected. */
  async send(msg: OutgoingMessage): Promise<void> {
    if (!this.producer) {
      throw new Error('KafkaProducer.send called before connect()');
    }
    await this.producer.send({
      topic: msg.topic,
      messages: [{ key: msg.key, value: JSON.stringify(msg.value) }],
    });
  }
}
