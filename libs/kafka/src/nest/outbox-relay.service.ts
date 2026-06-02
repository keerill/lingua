import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { OutboxRelay, type OutboxStore } from '../outbox';
import type { KafkaProducer } from '../producer';
import { KAFKA_PRODUCER } from './kafka.module';

export const OUTBOX_STORE = Symbol('OUTBOX_STORE');

@Injectable()
export class OutboxRelayService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly relay: OutboxRelay;

  constructor(
    @Inject(OUTBOX_STORE) store: OutboxStore,
    @Inject(KAFKA_PRODUCER) producer: KafkaProducer,
  ) {
    this.relay = new OutboxRelay(store, producer, {
      intervalMs: 1000,
      logger: {
        log: (m) => this.logger.log(m),
        error: (m, e) => this.logger.error(m, e as Error),
      },
    });
  }

  onApplicationBootstrap(): void {
    this.relay.start();
    this.logger.log('outbox relay started');
  }

  onModuleDestroy(): void {
    this.relay.stop();
  }
}
