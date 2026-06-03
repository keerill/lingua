import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { KafkaConsumer } from '@lingua/kafka';
import { CardCreatedEvent, Topics } from '@lingua/contracts';
import { CreateInitialScheduleUseCase } from '../../application/create-initial-schedule.usecase';

@Injectable()
export class CardCreatedConsumer
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CardCreatedConsumer.name);
  private readonly consumer: KafkaConsumer;

  constructor(
    private readonly createInitialSchedule: CreateInitialScheduleUseCase,
  ) {
    this.consumer = new KafkaConsumer({
      brokers: process.env.KAFKA_BROKERS ?? 'localhost:9092',
      clientId: 'svc-learning',
      groupId: 'svc-learning',
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe(
      [Topics.VocabularyCardCreated],
      async ({ value }) => {
        const event = value as CardCreatedEvent;
        if (event?.type !== Topics.VocabularyCardCreated) return;
        const { ownerId, cardId } = event.payload;
        await this.createInitialSchedule.execute(ownerId, cardId);
      },
    );
    this.logger.log(`subscribed to ${Topics.VocabularyCardCreated}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }
}
