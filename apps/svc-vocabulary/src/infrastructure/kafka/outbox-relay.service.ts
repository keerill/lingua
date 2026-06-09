import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { KAFKA_PRODUCER, KafkaProducer, OutboxRelay } from '@lingua/kafka';
import { PrismaOutboxStore } from './prisma-outbox.store';

/** Runs the transactional-outbox relay for svc-vocabulary. */
@Injectable()
export class OutboxRelayService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly relay: OutboxRelay;

  constructor(
    private readonly store: PrismaOutboxStore,
    @Inject(KAFKA_PRODUCER) private readonly producer: KafkaProducer,
  ) {
    this.relay = new OutboxRelay(this.store, this.producer, {
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
