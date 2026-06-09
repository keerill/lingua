import {
  DynamicModule,
  Module,
  OnApplicationShutdown,
  Provider,
} from '@nestjs/common';
import { KafkaProducer } from '../producer';
import { KafkaClientConfig } from '../client';

/** DI token for the shared, connected {@link KafkaProducer}. */
export const KAFKA_PRODUCER = Symbol('KAFKA_PRODUCER');

/**
 * Provides a single connected {@link KafkaProducer} for the importing service.
 * The producer connects lazily on first use via {@link KafkaProducerLifecycle}
 * and disconnects on application shutdown.
 */
@Module({})
export class KafkaModule implements OnApplicationShutdown {
  private static producerRef: KafkaProducer | null = null;

  static forRoot(config: KafkaClientConfig): DynamicModule {
    const producer = new KafkaProducer(config);
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
