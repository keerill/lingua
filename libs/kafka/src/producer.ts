import type { KafkaJS } from '@confluentinc/kafka-javascript';
import { createKafka, KafkaClientConfig } from './client';
import { jsonSerde, type KafkaSerde } from './serde';

export interface OutgoingMessage {
  topic: string;
  key: string;
  value: unknown;

  headers?: Record<string, string>;
}

export class KafkaProducer {
  private producer: KafkaJS.Producer | null = null;
  private readonly kafka: KafkaJS.Kafka;

  constructor(
    config: KafkaClientConfig,
    private readonly serde: KafkaSerde = jsonSerde,
  ) {
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

  async send(msg: OutgoingMessage): Promise<void> {
    if (!this.producer) {
      throw new Error('KafkaProducer.send called before connect()');
    }
    const value = await this.serde.serialize(msg.topic, msg.value);
    await this.producer.send({
      topic: msg.topic,
      messages: [{ key: msg.key, value, headers: msg.headers }],
    });
  }
}
