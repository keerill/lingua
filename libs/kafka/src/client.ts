import { KafkaJS } from '@confluentinc/kafka-javascript';

export interface KafkaClientConfig {
  /** Comma-separated broker list, e.g. "localhost:9092". */
  brokers: string;
  clientId: string;
}

/**
 * Create a Confluent Kafka client using the KafkaJS-compatibility surface.
 *
 * We deliberately use `@confluentinc/kafka-javascript` (the official, actively
 * maintained client) rather than the abandoned KafkaJS or NestJS's built-in
 * Kafka transport (which bundles KafkaJS). The `kafkaJS` config block selects
 * the compatibility API on top of the native librdkafka core.
 */
export function createKafka(config: KafkaClientConfig): KafkaJS.Kafka {
  return new KafkaJS.Kafka({
    kafkaJS: {
      clientId: config.clientId,
      brokers: config.brokers.split(',').map((b) => b.trim()),
    },
  });
}

export { KafkaJS };
