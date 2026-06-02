import { KafkaJS } from '@confluentinc/kafka-javascript';

export interface KafkaClientConfig {
  brokers: string;
  clientId: string;
}

export function buildKafkaConfig(
  config: KafkaClientConfig,
): KafkaJS.CommonConstructorConfig {
  const kafkaJS: KafkaJS.KafkaConfig = {
    clientId: config.clientId,
    brokers: config.brokers.split(',').map((b) => b.trim()),
  };

  const ca = process.env.KAFKA_SSL_CA?.trim();
  if (process.env.KAFKA_SSL === 'true' || ca) {
    kafkaJS.ssl = true;
  }

  const username = process.env.KAFKA_SASL_USERNAME?.trim();
  if (username) {
    kafkaJS.sasl = {
      mechanism: (process.env.KAFKA_SASL_MECHANISM?.trim() ||
        'scram-sha-256') as KafkaJS.SASLMechanism,
      username,
      password: process.env.KAFKA_SASL_PASSWORD ?? '',
    } as KafkaJS.SASLOptions;
  }

  const cfg: KafkaJS.CommonConstructorConfig = { kafkaJS };
  if (ca) cfg['ssl.ca.pem'] = ca;
  return cfg;
}

export function createKafka(config: KafkaClientConfig): KafkaJS.Kafka {
  return new KafkaJS.Kafka(buildKafkaConfig(config));
}

export { KafkaJS };
