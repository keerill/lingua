import {
  DynamicModule,
  Module,
  OnApplicationShutdown,
  Provider,
} from '@nestjs/common';
import { KafkaProducer } from '../producer';
import { KafkaClientConfig } from '../client';
import { type KafkaSerde } from '../serde';
import { resolveSerde } from '../serde-factory';

export const KAFKA_PRODUCER = Symbol('KAFKA_PRODUCER');

@Module({})
export class KafkaModule implements OnApplicationShutdown {
  private static producerRef: KafkaProducer | null = null;

  static forRoot(
    config: KafkaClientConfig,
    serde: KafkaSerde = resolveSerde(),
  ): DynamicModule {
    const producer = new KafkaProducer(config, serde);
    KafkaModule.producerRef = producer;

    const provider: Provider = {
      provide: KAFKA_PRODUCER,
      useFactory: async () => {
        await producer.connect();
        return producer;
      },
    };

    return {
      module: KafkaModule,
      global: true,
      providers: [provider],
      exports: [provider],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await KafkaModule.producerRef?.disconnect();
    KafkaModule.producerRef = null;
  }
}
